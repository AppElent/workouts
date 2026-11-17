import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { unstable_readConfig } from "wrangler";
import { foundryMcpViews } from "./src/lib/mcp/views/vitePlugin.ts";

// The release standard: `apps/mobile/app.json` (`expo.version`) is the one
// version for web and mobile, and every artefact names itself
// `<version>+<short sha>`. Sentry's release is `foundry@<version>+<short sha>`.
const version: string = JSON.parse(
	readFileSync(new URL("./apps/mobile/app.json", import.meta.url), "utf8"),
).expo.version;
const commit =
	process.env.GITHUB_SHA ||
	execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const release =
	process.env.SENTRY_RELEASE || `foundry@${version}+${commit.slice(0, 7)}`;

// The Wrangler environment being built (CLOUDFLARE_ENV) names the deployment;
// CI overrides it for bundles that are never deployed.
const sentryEnvironment =
	process.env.VITE_SENTRY_ENVIRONMENT ||
	unstable_readConfig(
		{ config: "wrangler.jsonc", env: process.env.CLOUDFLARE_ENV },
		{ hideWarnings: true },
	).vars.environment_name;

const config = defineConfig({
	define: {
		"import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(release),
		"import.meta.env.VITE_APP_VERSION": JSON.stringify(version),
		"import.meta.env.VITE_APP_COMMIT": JSON.stringify(commit),
		// Stamped by the deploy job's build, minutes before the Worker goes live.
		"import.meta.env.VITE_BUILT_AT": JSON.stringify(new Date().toISOString()),
		"import.meta.env.VITE_SENTRY_ENVIRONMENT":
			JSON.stringify(sentryEnvironment),
	},
	build: { sourcemap: "hidden" },
	server: {
		host: true,
		port: process.env.PORT ? Number(process.env.PORT) : 3000,
	},
	resolve: { tsconfigPaths: true },
	plugins: [
		foundryMcpViews(),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		cloudflare({
			viteEnvironment: {
				name: "ssr",
			},
		}),
		sentryVitePlugin({
			org: process.env.SENTRY_ORG || "appelent",
			project: process.env.SENTRY_PROJECT || "foundry",
			authToken: process.env.SENTRY_AUTH_TOKEN,
			release: { name: release },
			disable: !process.env.SENTRY_AUTH_TOKEN,
			sourcemaps: { assets: ["dist/**/*.map", "dist/**/*.js"] },
			telemetry: false,
		}),
	],
});

export default config;
