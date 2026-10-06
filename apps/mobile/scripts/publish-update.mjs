import { spawnSync } from "node:child_process";

// Check before publishing: a successful OTA without its maps is hard to debug.
if (!process.env.SENTRY_AUTH_TOKEN) {
	console.error("SENTRY_AUTH_TOKEN is required to publish an update with source maps.");
	process.exit(1);
}

const env = {
	...process.env,
	SENTRY_ORG: process.env.SENTRY_ORG || "appelent",
	SENTRY_PROJECT: process.env.SENTRY_PROJECT || "foundry",
};

for (const args of [
	["exec", "eas", "update", ...process.argv.slice(2)],
	["exec", "sentry-expo-upload-sourcemaps", "dist"],
]) {
	const result = spawnSync("pnpm", args, { env, stdio: "inherit" });
	if (result.error) console.error(result.error.message);
	if (result.status !== 0) process.exit(result.status || 1);
}
