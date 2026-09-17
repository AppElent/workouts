#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const METADATA_FILE = ".worktree-setup.json";
const DEPLOY_KEY = "CONVEX_DEPLOY_KEY";
const REFERENCE_MAX_LENGTH = 100;

function shortHash(value) {
	return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

export function sanitizeComponent(value, maxLength = 40) {
	const sanitized = String(value)
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	const fallback = sanitized || "worktree";
	if (fallback.length <= maxLength) return fallback;
	return `${fallback.slice(0, maxLength - 9).replace(/-$/g, "")}-${shortHash(fallback)}`;
}

export function deriveDeploymentReference({
	worktreePath,
	userName,
	editor = "worktree",
}) {
	const editorPart = sanitizeComponent(editor, 24);
	const userPart = sanitizeComponent(userName || "agent", 24);
	const directory = sanitizeComponent(
		path.basename(path.resolve(worktreePath)),
		80,
	);
	const prefix = `${editorPart}-`;
	const worktreePart = sanitizeComponent(
		directory.startsWith(prefix) ? directory.slice(prefix.length) : directory,
		48,
	);
	const namespace = sanitizeComponent(`${userPart}-${editorPart}`, 49);
	let reference = `dev/${namespace}/${worktreePart}`;
	if (reference.length > REFERENCE_MAX_LENGTH) {
		const available = REFERENCE_MAX_LENGTH - `dev/${namespace}/`.length;
		reference = `dev/${namespace}/${sanitizeComponent(worktreePart, available)}`;
	}
	if (!/^[a-z0-9/-]{3,100}$/.test(reference)) {
		throw new Error(`Could not derive a valid Convex deployment reference.`);
	}
	return reference;
}

function parseBoolean(value, option) {
	if (value === "true") return true;
	if (value === "false") return false;
	throw new Error(`${option} must be true or false.`);
}

export function parseArgs(argv) {
	const options = {
		convex: "none",
		editor: "worktree",
		expiration: "in 5 days",
		install: true,
		push: true,
		scopedKey: true,
		dryRun: false,
		project: undefined,
	};
	const valued = new Set([
		"convex",
		"project",
		"expiration",
		"editor",
		"scoped-key",
		"install",
		"push",
	]);

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (argument === "--help" || argument === "-h") {
			options.help = true;
			continue;
		}
		if (!argument.startsWith("--"))
			throw new Error(`Unknown argument: ${argument}`);
		const equals = argument.indexOf("=");
		const name = argument.slice(2, equals === -1 ? undefined : equals);
		if (!valued.has(name)) throw new Error(`Unknown option: --${name}`);
		const value = equals === -1 ? argv[++index] : argument.slice(equals + 1);
		if (value === undefined || value.startsWith("--")) {
			throw new Error(`--${name} requires a value.`);
		}
		switch (name) {
			case "convex":
				options.convex = value;
				break;
			case "project":
				options.project = value;
				break;
			case "expiration":
				options.expiration = value;
				break;
			case "editor":
				options.editor = value;
				break;
			case "scoped-key":
				options.scopedKey = parseBoolean(value, "--scoped-key");
				break;
			case "install":
				options.install = parseBoolean(value, "--install");
				break;
			case "push":
				options.push = parseBoolean(value, "--push");
				break;
		}
	}

	if (!["none", "cloud", "local"].includes(options.convex)) {
		throw new Error("--convex must be none, cloud, or local.");
	}
	if (
		options.convex === "cloud" &&
		(!options.project || !/^[a-zA-Z0-9-]+:[a-zA-Z0-9-]+$/.test(options.project))
	) {
		throw new Error("Cloud mode requires --project=team-slug:project-slug.");
	}
	return options;
}

function splitLines(content) {
	return content.match(/.*(?:\r\n|\n|$)/g)?.filter(Boolean) ?? [];
}

function envLinePattern(name) {
	return new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`);
}

export function removeEnvVariable(content, name) {
	const pattern = envLinePattern(name);
	return splitLines(content)
		.filter((line) => !pattern.test(line))
		.join("");
}

export function readEnvValue(content, name) {
	const pattern = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)\\s*$`);
	for (const line of splitLines(content)) {
		const match = line.replace(/\r?\n$/, "").match(pattern);
		if (!match) continue;
		const value = match[1];
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			return value.slice(1, -1);
		}
		return value;
	}
	return undefined;
}

export function setEnvVariable(content, name, value) {
	const newline = content.includes("\r\n") ? "\r\n" : "\n";
	const pattern = envLinePattern(name);
	let replaced = false;
	const lines = splitLines(content).filter((line) => {
		if (!pattern.test(line)) return true;
		if (replaced) return false;
		replaced = true;
		return true;
	});
	if (replaced) {
		return lines
			.map((line) =>
				pattern.test(line)
					? `${name}=${value}${line.endsWith("\r\n") ? "\r\n" : line.endsWith("\n") ? "\n" : ""}`
					: line,
			)
			.join("");
	}
	const separator =
		content.length > 0 && !content.endsWith("\n") ? newline : "";
	return `${content}${separator}${name}=${value}${newline}`;
}

async function readText(filePath) {
	try {
		return await readFile(filePath, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return "";
		throw error;
	}
}

export async function atomicWrite(filePath, content) {
	await mkdir(path.dirname(filePath), { recursive: true });
	const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
	try {
		await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
		await rename(temporary, filePath);
	} finally {
		await rm(temporary, { force: true });
	}
}

export function pnpmExecutable(platform = process.platform) {
	return platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function redactSecrets(value) {
	return String(value)
		.replace(/(CONVEX_DEPLOY_KEY\s*=\s*)[^\s]+/gi, "$1[REDACTED]")
		.replace(
			/\b(?:dev|prod|preview|project|team):[^\s|]+\|[^\s]+/g,
			"[REDACTED]",
		);
}

export function createCommandRunner() {
	return async ({ command, args, cwd, env }) =>
		new Promise((resolve, reject) => {
			const child = spawn(command, args, {
				cwd,
				env,
				shell: false,
				windowsHide: true,
			});
			let stdout = "";
			let stderr = "";
			child.stdout.on("data", (chunk) => {
				stdout += chunk;
			});
			child.stderr.on("data", (chunk) => {
				stderr += chunk;
			});
			child.on("error", reject);
			child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
		});
}

function isExplicitlyMissing(result) {
	const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
	return [
		/deployment[^\n]*(?:does not exist|not found|could not find)/,
		/(?:does not exist|not found|could not find)[^\n]*deployment/,
		/no (?:local )?deployment found/,
	].some((pattern) => pattern.test(output));
}

async function readMetadata(filePath) {
	try {
		return JSON.parse(await readFile(filePath, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT" || error instanceof SyntaxError)
			return undefined;
		throw error;
	}
}

function publicHostname(url) {
	try {
		return new URL(url).hostname;
	} catch {
		throw new Error(
			"Convex selected a deployment but did not write a valid VITE_CONVEX_URL.",
		);
	}
}

function safeCommand(command, args) {
	return [command, ...args]
		.map((part) => (part.includes(" ") ? JSON.stringify(part) : part))
		.join(" ");
}

export async function setupWorktree(options, dependencies = {}) {
	const cwd = path.resolve(dependencies.cwd ?? process.cwd());
	const platform = dependencies.platform ?? process.platform;
	const processEnv = dependencies.env ?? process.env;
	const logger = dependencies.logger ?? console.log;
	const errorLogger = dependencies.errorLogger ?? console.error;
	const runner = dependencies.runner ?? createCommandRunner();
	const pnpm = pnpmExecutable(platform);
	const rootEnvPath = path.join(cwd, ".env.local");
	const mobileEnvPath = path.join(cwd, "apps", "mobile", ".env.local");
	const metadataPath = path.join(cwd, METADATA_FILE);
	const childEnv = { ...processEnv };
	delete childEnv[DEPLOY_KEY];
	delete childEnv.CONVEX_DEPLOYMENT;
	delete childEnv.VITE_CONVEX_URL;
	delete childEnv.CONVEX_SITE_URL;

	const run = async (args, label) => {
		logger(`$ ${safeCommand(pnpm, args)}`);
		const result = await runner({ command: pnpm, args, cwd, env: childEnv });
		if (result.code !== 0 && label) {
			if (result.stdout) logger(redactSecrets(result.stdout.trimEnd()));
			if (result.stderr) errorLogger(redactSecrets(result.stderr.trimEnd()));
			throw new Error(`${label} failed with exit code ${result.code}.`);
		}
		return result;
	};

	if (options.install) {
		if (options.dryRun) logger(`$ ${pnpm} install`);
		else await run(["install"], "Dependency installation");
	}

	if (options.convex === "none") {
		logger("Convex setup skipped (--convex=none).");
		return { mode: "none" };
	}

	const reference =
		options.convex === "local"
			? "local"
			: deriveDeploymentReference({
					worktreePath: cwd,
					userName:
						processEnv.USERNAME || processEnv.USER || os.userInfo().username,
					editor: options.editor,
				});
	const qualifiedReference =
		options.convex === "cloud" ? `${options.project}:${reference}` : reference;

	if (options.dryRun) {
		logger(`Would select or create Convex deployment: ${qualifiedReference}`);
		if (options.convex === "cloud" && options.scopedKey) {
			logger(
				`$ ${pnpm} exec convex deployment token create agent-token --save-env`,
			);
		}
		if (options.convex === "cloud" && options.push) {
			logger(`$ ${pnpm} exec convex dev --once`);
		}
		if (options.convex === "local") {
			logger(
				`$ ${pnpm} exec convex dev --once  # only if local configuration is missing`,
			);
			logger(
				"After setup, keep `pnpm exec convex dev` running; --once does not keep a local backend alive.",
			);
		}
		return {
			mode: options.convex,
			reference: qualifiedReference,
			dryRun: true,
		};
	}

	let rootEnv = await readText(rootEnvPath);
	let metadata = await readMetadata(metadataPath);
	const selectedDeployment = readEnvValue(rootEnv, "CONVEX_DEPLOYMENT");
	const alreadyConfigured =
		metadata?.mode === options.convex &&
		metadata?.reference === qualifiedReference &&
		metadata?.deploymentName === selectedDeployment &&
		Boolean(selectedDeployment) &&
		Boolean(readEnvValue(rootEnv, "VITE_CONVEX_URL"));

	if (alreadyConfigured) {
		logger(`Deployment already configured; reusing ${qualifiedReference}.`);
	} else {
		const originalRootEnv = rootEnv;
		const envWithoutDeployKey = removeEnvVariable(rootEnv, DEPLOY_KEY);
		if (envWithoutDeployKey !== rootEnv) {
			await atomicWrite(rootEnvPath, envWithoutDeployKey);
			rootEnv = envWithoutDeployKey;
		}

		try {
			const selectResult = await run([
				"exec",
				"convex",
				"deployment",
				"select",
				qualifiedReference,
			]);
			if (selectResult.code === 0) {
				logger(`Deployment exists; selected ${qualifiedReference}.`);
			} else if (isExplicitlyMissing(selectResult)) {
				if (options.convex === "local") {
					logger(
						"Local deployment does not exist; configuring an isolated local backend.",
					);
					for (const name of [
						"CONVEX_DEPLOYMENT",
						"VITE_CONVEX_URL",
						"CONVEX_SITE_URL",
					]) {
						rootEnv = removeEnvVariable(rootEnv, name);
					}
					await atomicWrite(rootEnvPath, rootEnv);
					await run(
						["exec", "convex", "dev", "--once"],
						"Local Convex configuration",
					);
				} else {
					logger(`Deployment does not exist; creating ${qualifiedReference}.`);
					await run(
						[
							"exec",
							"convex",
							"deployment",
							"create",
							qualifiedReference,
							"--select",
							"--type",
							"dev",
							"--expiration",
							options.expiration,
						],
						"Convex deployment creation",
					);
				}
			} else {
				const failure = (selectResult.stderr || selectResult.stdout).trim();
				if (failure) errorLogger(redactSecrets(failure));
				throw new Error(
					"Convex deployment lookup failed without an explicit not-found response; refusing to create a deployment.",
				);
			}
		} catch (error) {
			await atomicWrite(rootEnvPath, originalRootEnv);
			throw error;
		}

		rootEnv = await readText(rootEnvPath);
		metadata = {
			mode: options.convex,
			reference: qualifiedReference,
			deploymentName: readEnvValue(rootEnv, "CONVEX_DEPLOYMENT"),
			scopedKeyCreated: false,
		};
		await atomicWrite(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
	}

	if (options.convex === "cloud" && options.scopedKey) {
		const existingKey = readEnvValue(rootEnv, DEPLOY_KEY);
		const selectedDeployment = readEnvValue(rootEnv, "CONVEX_DEPLOYMENT");
		const keyMatchesSelection =
			existingKey &&
			selectedDeployment &&
			existingKey.slice(0, existingKey.indexOf("|")) === selectedDeployment;
		if ((metadata?.scopedKeyCreated || keyMatchesSelection) && existingKey) {
			logger("Deployment-scoped key already configured; reusing it.");
			if (!metadata?.scopedKeyCreated) {
				metadata = { ...metadata, scopedKeyCreated: true };
				await atomicWrite(
					metadataPath,
					`${JSON.stringify(metadata, null, 2)}\n`,
				);
			}
		} else {
			const envWithoutDeployKey = removeEnvVariable(rootEnv, DEPLOY_KEY);
			if (envWithoutDeployKey !== rootEnv) {
				await atomicWrite(rootEnvPath, envWithoutDeployKey);
				rootEnv = envWithoutDeployKey;
			}
			await run(
				[
					"exec",
					"convex",
					"deployment",
					"token",
					"create",
					"agent-token",
					"--save-env",
				],
				"Deployment-scoped key creation",
			);
			rootEnv = await readText(rootEnvPath);
			metadata = { ...metadata, scopedKeyCreated: true };
			await atomicWrite(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
		}
	}

	rootEnv = await readText(rootEnvPath);
	const convexUrl = readEnvValue(rootEnv, "VITE_CONVEX_URL");
	if (!convexUrl) {
		throw new Error(
			"Convex selected a deployment but VITE_CONVEX_URL is missing from .env.local.",
		);
	}
	const mobileEnv = await readText(mobileEnvPath);
	await atomicWrite(
		mobileEnvPath,
		setEnvVariable(mobileEnv, "EXPO_PUBLIC_CONVEX_URL", convexUrl),
	);

	if (options.convex === "cloud" && options.push) {
		await run(["exec", "convex", "dev", "--once"], "Convex function push");
	}

	logger(`Selected deployment: ${qualifiedReference}`);
	logger(`Public hostname: ${publicHostname(convexUrl)}`);
	if (options.convex === "local") {
		logger(
			"Keep `pnpm exec convex dev` running while using this worktree; `convex dev --once` would stop the local backend.",
		);
	}
	return {
		mode: options.convex,
		reference: qualifiedReference,
		hostname: publicHostname(convexUrl),
		reused: alreadyConfigured,
	};
}

export function helpText() {
	return `Usage: pnpm setup:worktree -- [options]

  --convex=none|cloud|local  Deployment mode (default: none)
  --project=team:project     Required for cloud mode
  --expiration="in 5 days"   Cloud deployment expiration
  --editor=t3code            Stable editor label (generic values accepted)
  --scoped-key=true|false    Create a deployment-scoped key (default: true)
  --install=true|false       Install dependencies (default: true)
  --push=true|false          Push cloud functions once (default: true)
  --dry-run                  Print the plan without commands or file writes`;
}

async function main() {
	try {
		const options = parseArgs(process.argv.slice(2));
		if (options.help) {
			console.log(helpText());
			return;
		}
		await setupWorktree(options);
	} catch (error) {
		console.error(
			redactSecrets(error instanceof Error ? error.message : error),
		);
		process.exitCode = 1;
	}
}

const isEntryPoint =
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) await main();
