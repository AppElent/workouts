import { execFileSync } from "node:child_process";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { unstable_readConfig } from "wrangler";
import { foundryMcpViews } from "./src/lib/mcp/views/vitePlugin.ts";

const release =
	process.env.SENTRY_RELEASE ||
	execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

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
