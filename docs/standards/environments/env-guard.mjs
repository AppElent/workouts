#!/usr/bin/env node
// PreToolUse guard for `pnpm env:*` (developer-home standards/environments.md).
// The allow rules in .claude/settings.json cover `env:check`, `env:plan`,
// `env:generate` and `env:apply <environment>`. This hook keeps them to plain,
// non-destructive shapes in this repository. Anything else (--prune, --yes,
// --path, which would run another folder's manifest, ...) is denied at once
// with the reason, so an unattended agent (a T3 thread) sees why and asks Eric
// instead of stalling on a prompt nobody watches (APP-1004, 28 Nov 2026).
// `env:exec` is never covered by an allow rule.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ENV_SCRIPT = /^\s*pnpm\s+(?:run\s+)?env:(apply|plan|check|generate)(?=\s|$)/;
// A package manager running an env script anywhere in a command: after the
// start, a separator, a wrapper or a subshell. Quotes in between (`pnpm
// "env:apply"`) still count.
const RUNS_ENV_SCRIPT = /\b(?:pnpm|npm|yarn|bun|corepack|npx)\b[^;&|\n]*?\benv:(?:apply|plan|check|generate)\b/;
// `pnpm --dir <path>` / `-C <path>` in front of the script: the same as
// running it from <path>. A plain path only, without `..`.
const DIR_FLAG = /^(\s*pnpm\s+)(?:--dir(?:\s+|=)|-C\s*)([A-Za-z0-9_./@+][A-Za-z0-9_./@+-]*)\s+(?=(?:run\s+)?env:)/;
// Commands that only read: a pattern or file name that mentions env is not a run.
const READERS = new Set(["cat", "grep", "egrep", "fgrep", "rg", "head", "tail", "wc", "ls", "less", "jq", "cd", "true"]);
const GIT_READS = new Set(["grep", "log", "show", "diff", "status", "blame"]);
const ENVIRONMENTS = new Set(["local", "dev", "preview", "staging", "production"]);
const KINDS = new Set(["infisical", "file", "convex", "worker", "github", "eas"]);
// The read-only `env:check` may keep the wrappers agents put around it: one
// leading `cd <plain path>;` (or `&&`), then a trailing `2>&1` and one
// `| tail`/`| head` with at most a line count. Nothing else is peeled off.
const CD_PREFIX = /^\s*cd\s+([A-Za-z0-9_./@+][A-Za-z0-9_./@+-]*)\s*(?:;|&&)\s*/;
const READ_SUFFIX = /\s+(?:2>&1\s*)?(?:\|\s*(?:tail|head)(?:\s+(?:-n\s*[1-9][0-9]*|-[1-9][0-9]*))?\s*)?$/;

// apply and plan need an environment; check takes an optional one; generate
// takes only --dry-run/--json.
function allowedShape(script, words) {
  let rest = words;
  if (script === "generate") return words.every((word) => word === "--dry-run" || word === "--json");
  if (ENVIRONMENTS.has(words[0])) rest = words.slice(1);
  else if (script !== "check") return false;
  for (let i = 0; i < rest.length; i += 1) {
    const word = rest[i];
    if (word === "--json" || (word === "--dry-run" && script === "apply")) continue;
    if (word === "--ci" && script === "check") continue;
    if (word === "--only" && KINDS.has(rest[i + 1])) { i += 1; continue; }
    if (word === "--pr" && /^[1-9][0-9]*$/.test(rest[i + 1] ?? "")) { i += 1; continue; }
    return false; // --prune, --yes, --path, apply --ci, a second positional, ...
  }
  return true;
}

// Returns the `env:check` command inside the allowed wrappers, or the command
// unchanged when it has no wrappers or the inner command is not env:check.
function unwrapCheck(command) {
  let inner = command;
  const cd = CD_PREFIX.exec(inner);
  if (cd) inner = inner.slice(cd[0].length);
  const suffix = READ_SUFFIX.exec(inner);
  if (suffix && suffix[0].trim()) inner = inner.slice(0, suffix.index);
  if (inner === command) return command;
  return ENV_SCRIPT.exec(inner)?.[1] === "check" ? inner : command;
}

// Splits a command on ; & | and newlines outside quotes.
function segments(command) {
  const parts = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    if (quote) {
      if (char === "\\" && quote === '"') { current += char + (command[i + 1] ?? ""); i += 1; continue; }
      if (char === quote) quote = null;
      current += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      current += char;
    } else if (char === "\\") {
      current += char + (command[i + 1] ?? "");
      i += 1;
    } else if (/[;&|\n]/.test(char)) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  parts.push(current);
  return { parts: parts.map((part) => part.trim()).filter(Boolean), closed: quote === null };
}

// True when every part of the command only reads (grep, cat, rg, git log, ...),
// so env words in its patterns and file names cannot run anything. Command
// substitution, process substitution and rg's --pre run code, so they never count.
function onlyReads(command) {
  if (/\$\(|`|<\(|>\(|--pre\b/.test(command)) return false;
  const { parts, closed } = segments(command);
  if (!closed || parts.length === 0) return false;
  return parts.every((part) => {
    const [first, second] = part.split(/\s+/);
    if (first === "git") return GIT_READS.has(second);
    return READERS.has(first);
  });
}

// Decides a Bash command: "deny" with the reason, "allow" for a `--dir`/`-C`
// run that no allow rule matches but the bare command would, or null to leave
// it to the allow rules and the normal permission flow.
export function decide(rawCommand) {
  if (typeof rawCommand !== "string") return null;
  const dir = DIR_FLAG.exec(rawCommand);
  if (dir) {
    const path = dir[2];
    const bare = rawCommand.replace(DIR_FLAG, "$1");
    if (path.split("/").includes("..")) return { action: "deny", reason: "pnpm --dir with `..` is not auto-allowed; run the env script from the app folder itself." };
    const reason = evaluate(bare);
    if (reason) return { action: "deny", reason };
    const script = ENV_SCRIPT.exec(unwrapCheck(bare))?.[1];
    // apply writes to the providers: it stays a plain `pnpm env:apply <env>`
    // run from the app folder, where the allow rules already cover it.
    if (script === "apply") return { action: "deny", reason: `run env:apply without --dir/-C: \`cd ${path}\` first, then \`pnpm env:apply ...\` on its own.` };
    return { action: "allow", reason: `env:${script} in ${path}, the same as the bare command.` };
  }
  const reason = evaluate(rawCommand);
  return reason ? { action: "deny", reason } : null;
}

// Returns the reason the command is refused, or null when it passes.
export function evaluate(rawCommand) {
  if (typeof rawCommand !== "string") return null;
  if (DIR_FLAG.test(rawCommand)) return decide(rawCommand)?.action === "deny" ? decide(rawCommand).reason : null;
  const command = unwrapCheck(rawCommand);
  const match = ENV_SCRIPT.exec(command);
  // The allow rules also match subcommands of a compound command (`a && b`) or a
  // wrapper (`timeout 5 ...`), so any other mention of these scripts needs a prompt.
  if (!match) {
    // Only a run of the scripts counts: a package manager word followed by an
    // env script. A read that merely names one (`grep "env:generate"
    // package.json`, `cat env.manifest.ts`) is left to the other checks
    // (28 Nov 2026: such reads stopped T3 threads on a prompt).
    if (!RUNS_ENV_SCRIPT.test(command) || onlyReads(command)) return null;
    return "env scripts run only as a standalone `pnpm env:<script> ...` command (optionally `pnpm --dir <path> env:check|plan|generate`); run it on its own, or ask Eric.";
  }
  if (/[;&|`<>'"\\$(){}*?[\]~!#\n]/.test(command)) return "only plain, unquoted env commands are auto-allowed.";
  const words = command.slice(match[0].length).trim().split(/\s+/).filter(Boolean);
  if (!allowedShape(match[1], words)) return `this env:${match[1]} shape is not auto-allowed; --prune, --yes, --path and apply --ci need a prompt.`;
  return null;
}

function answer(action, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: action,
        permissionDecisionReason: `env-guard: ${reason}`,
      },
    }),
  );
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    answer("deny", "could not read the tool input."); // fail closed
  }
  const result = decide(input?.tool_input?.command);
  if (result) answer(result.action, result.reason);
  process.exit(0);
}
