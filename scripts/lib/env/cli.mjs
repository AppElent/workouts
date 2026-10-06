import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { applyEnvironment, checkEnvironment, checkManifestAndExample, } from "./engine.mjs";
import { atomicWrite } from "./files.mjs";
import { loadEnvironmentManifest, renderEnvironmentExample, validateEnvironmentManifest, } from "./manifest.mjs";
import { planOwnedRemovals, readOwnership } from "./ownership.mjs";
import { planEnvironment } from "./planning.mjs";
import { runProcess as defaultRunProcess } from "./process.mjs";
import { loadInfisicalSource } from "./source.mjs";
const kinds = new Set([
    "infisical",
    "file",
    "convex",
    "worker",
    "github",
    "eas",
]);
function parse(args, environ) {
    const result = {
        json: false,
        dryRun: false,
        help: false,
        ci: false,
        prune: false,
        yes: false,
        prNumber: environ.PR_NUMBER,
    };
    const positionals = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        switch (arg) {
            case "--json":
                result.json = true;
                break;
            case "--dry-run":
                result.dryRun = true;
                break;
            case "--help":
            case "-h":
                result.help = true;
                break;
            case "--ci":
                result.ci = true;
                break;
            case "--prune":
                result.prune = true;
                break;
            case "--yes":
                result.yes = true;
                break;
            case "--pr":
                index += 1;
                result.prNumber = args[index];
                if (!result.prNumber)
                    result.error = "--pr requires a value";
                break;
            case "--only": {
                index += 1;
                const value = args[index];
                if (!value || !kinds.has(value))
                    result.error =
                        "--only must be infisical, file, convex, worker, github, or eas";
                else
                    result.only = value;
                break;
            }
            default:
                if (arg?.startsWith("-"))
                    result.error = `Unsupported option ${arg}`;
                else if (arg)
                    positionals.push(arg);
        }
    }
    [result.command, result.environment] = positionals;
    if (positionals.length > 2)
        result.error = "Too many positional arguments";
    if (result.prNumber !== undefined && !/^[1-9][0-9]*$/.test(result.prNumber))
        result.error = "--pr requires a positive pull request number";
    return result;
}
function usage() {
    return [
        "Usage:",
        "  node scripts/env.mjs generate [--dry-run] [--json]",
        "  node scripts/env.mjs check [environment] [--ci] [--only <kind>] [--pr <n>] [--json]",
        "  node scripts/env.mjs plan <environment> [--only <kind>] [--pr <n>] [--json]",
        "  node scripts/env.mjs apply <environment> [--only <kind>] [--pr <n>] [--prune] [--yes] [--dry-run] [--json]",
    ].join("\n");
}
function render(payload) {
    const lines = [
        `env ${payload.command}${payload.environment ? ` ${payload.environment}` : ""}`,
    ];
    for (const operation of payload.operations)
        lines.push(`  ${operation.action === "remove" ? "-" : "→"} ${operation.destination}${operation.name ? `/${operation.name}` : ""}`);
    for (const finding of payload.findings)
        lines.push(`  ${finding.level === "error" ? "✗" : finding.level === "warning" ? "!" : "·"} ${finding.message}`);
    if (lines.length === 1)
        lines.push("  ✓ no changes or findings");
    return `${lines.join("\n")}\n`;
}
function emit(io, json, root, payload, exitCode) {
    if (json) {
        io.writeOut(`${JSON.stringify({ schemaVersion: 1, command: "env", ok: exitCode === 0, exitCode, projectRoot: root, result: payload }, null, 2)}\n`);
    }
    else if (exitCode === 2) {
        io.writeErr(`${render(payload)}${usage()}\n`);
    }
    else {
        io.writeOut(render(payload));
    }
}
function failure(command, code, message, environment) {
    return {
        command,
        environment,
        operations: [],
        findings: [{ level: "error", code, message }],
    };
}
async function defaultConfirm(question) {
    const terminal = createInterface({ input: stdin, output: stdout });
    try {
        return (await terminal.question(question)).trim();
    }
    finally {
        terminal.close();
    }
}
export async function runEnvCli(args, options) {
    const io = options.io ?? {
        writeOut: (value) => process.stdout.write(value),
        writeErr: (value) => process.stderr.write(value),
    };
    const environ = options.dependencies?.environ ?? process.env;
    const parsed = parse(args, environ);
    const finish = (payload, exitCode) => {
        emit(io, parsed.json, options.root, payload, exitCode);
        return { exitCode };
    };
    if (parsed.help) {
        return finish({
            command: "help",
            operations: [],
            findings: [{ level: "note", code: "usage", message: usage() }],
        }, 0);
    }
    if (parsed.error ||
        !parsed.command ||
        !["check", "plan", "apply", "generate"].includes(parsed.command)) {
        return finish(failure(parsed.command ?? "unknown", "usage", parsed.error ?? "Expected check, plan, apply, or generate"), 2);
    }
    let manifest;
    try {
        manifest =
            options.manifest ??
                (await loadEnvironmentManifest(options.root, options.manifestPath));
    }
    catch {
        return finish(failure(parsed.command, "manifest.unavailable", "Environment manifest could not be loaded", parsed.environment), 1);
    }
    const manifestFindings = validateEnvironmentManifest(manifest);
    if (manifestFindings.some((item) => item.level === "error"))
        return finish({
            command: parsed.command,
            environment: parsed.environment,
            operations: [],
            findings: manifestFindings,
        }, 1);
    if (parsed.command === "generate") {
        if (parsed.environment)
            return finish(failure("generate", "usage", "generate does not accept an environment"), 2);
        try {
            const rendered = renderEnvironmentExample(manifest);
            let current = null;
            try {
                current = await readFile(join(options.root, ".env.example"), "utf8");
            }
            catch {
                /* missing */
            }
            const findings = [];
            const operations = current === rendered
                ? []
                : [{ action: "write", destination: ".env.example" }];
            const ownedExample = current === null ||
                current.startsWith("# Generated by @appelent/dev env generate") ||
                current.startsWith("# Generated by `pnpm run env:generate`");
            if (!ownedExample)
                findings.push({
                    level: "error",
                    code: "file.human-owned",
                    message: ".env.example exists and is not generated by Appelent env",
                });
            if (!parsed.dryRun && operations.length > 0 && findings.length === 0)
                await atomicWrite(options.root, ".env.example", rendered);
            const exitCode = findings.some((item) => item.level === "error") ? 1 : 0;
            return finish({
                command: parsed.dryRun ? "generate (dry run)" : "generate",
                operations,
                findings,
            }, exitCode);
        }
        catch {
            return finish(failure("generate", "generate.failed", "Environment example could not be generated"), 1);
        }
    }
    if (!parsed.environment) {
        if (parsed.command !== "check")
            return finish(failure(parsed.command, "usage", `${parsed.command} requires an environment`), 2);
        try {
            const findings = await checkManifestAndExample(options.root, manifest);
            return finish({ command: "check", operations: [], findings }, findings.some((item) => item.level === "error") ? 1 : 0);
        }
        catch {
            return finish(failure("check", "check.failed", "Environment manifest check could not complete"), 1);
        }
    }
    if (!manifest.ENVIRONMENTS.includes(parsed.environment))
        return finish(failure(parsed.command, "usage", `Unknown environment. Expected: ${manifest.ENVIRONMENTS.join(", ")}`, parsed.environment), 2);
    const runProcess = options.dependencies?.runProcess ?? defaultRunProcess;
    let source;
    try {
        const loader = options.dependencies?.loadSource ?? loadInfisicalSource;
        source = await loader({
            root: options.root,
            environment: parsed.environment,
            manifest,
            runProcess,
        });
    }
    catch (error) {
        const kind = error && typeof error === "object" && "kind" in error
            ? String(error.kind)
            : "unavailable";
        return finish(failure(parsed.command, `source.${kind}`, `Canonical source is ${kind}`, parsed.environment), 1);
    }
    const planOptions = { only: parsed.only, prNumber: parsed.prNumber };
    if (parsed.command === "plan" || parsed.dryRun) {
        try {
            const planned = planEnvironment(manifest, parsed.environment, source, planOptions);
            const removals = parsed.prune
                ? planOwnedRemovals(manifest, parsed.environment, planned.placements, await readOwnership(options.root), parsed.prNumber)
                : [];
            return finish({
                command: parsed.dryRun
                    ? `${parsed.command} (dry run)`
                    : parsed.command,
                environment: parsed.environment,
                operations: [...planned.plan.operations, ...removals],
                findings: planned.plan.findings,
            }, planned.plan.findings.some((item) => item.level === "error") ? 1 : 0);
        }
        catch {
            return finish(failure(parsed.command, "plan.failed", "Environment plan could not complete", parsed.environment), 1);
        }
    }
    if (parsed.command === "check") {
        try {
            const result = await checkEnvironment({
                root: options.root,
                manifest,
                environment: parsed.environment,
                source,
                runProcess,
                options: { ...planOptions, ci: parsed.ci, environ },
            });
            return finish({
                command: "check",
                environment: parsed.environment,
                operations: [],
                findings: result.findings,
            }, result.findings.some((item) => item.level === "error") ? 1 : 0);
        }
        catch {
            return finish(failure("check", "check.failed", "Environment check could not complete", parsed.environment), 1);
        }
    }
    if (parsed.prune && parsed.environment === "production" && !parsed.yes) {
        if (parsed.json) {
            return finish(failure("apply", "usage", "Production pruning in JSON mode requires --yes", parsed.environment), 2);
        }
        try {
            const answer = await (options.dependencies?.confirm ?? defaultConfirm)("Type production to allow owned-key pruning: ");
            if (answer !== "production")
                return finish(failure("apply", "apply.aborted", "Apply was aborted", parsed.environment), 1);
        }
        catch {
            return finish(failure("apply", "apply.aborted", "Apply was aborted", parsed.environment), 1);
        }
    }
    try {
        const result = await applyEnvironment({
            root: options.root,
            manifest,
            environment: parsed.environment,
            source,
            runProcess,
            options: { ...planOptions, prune: parsed.prune },
        });
        return finish({
            command: "apply",
            environment: parsed.environment,
            operations: result.operations,
            findings: result.findings,
        }, result.findings.some((item) => item.level === "error") ? 1 : 0);
    }
    catch {
        return finish(failure("apply", "apply.failed", "Environment apply could not complete", parsed.environment), 1);
    }
}
