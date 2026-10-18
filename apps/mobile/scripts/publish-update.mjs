import { spawnSync } from "node:child_process";

// Check before publishing: a successful OTA without its maps is hard to debug.
if (!process.env.SENTRY_AUTH_TOKEN) {
	console.error("SENTRY_AUTH_TOKEN is required to publish an update with source maps.");
	process.exit(1);
}

// app.config.ts picks the bundle ID and scheme from APP_VARIANT. Updates for
// a channel must carry that channel's identity, or OAuth callbacks and Apple
// revocation in the update would target another variant.
const args = process.argv.slice(2);
const channel = args[args.indexOf("--channel") + 1];
const variant = process.env.APP_VARIANT || channel;
if (!["development", "preview", "production"].includes(variant)) {
	console.error("Pass --channel development|preview|production, or set APP_VARIANT.");
	process.exit(1);
}

const env = {
	...process.env,
	APP_VARIANT: variant,
	SENTRY_ORG: process.env.SENTRY_ORG || "appelent",
	SENTRY_PROJECT: process.env.SENTRY_PROJECT || "foundry",
};

for (const args of [
	["exec", "eas", "update", ...args],
	["exec", "sentry-expo-upload-sourcemaps", "dist"],
]) {
	const result = spawnSync("pnpm", args, { env, stdio: "inherit" });
	if (result.error) console.error(result.error.message);
	if (result.status !== 0) process.exit(result.status || 1);
}
