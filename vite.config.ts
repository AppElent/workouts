import { execFileSync } from "node:child_process";
import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const release =
	process.env.SENTRY_RELEASE ||
	execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const config = defineConfig({
	define: {
		"import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(release),
	},
	build: { sourcemap: "hidden" },
	server: {
		host: true,
		port: process.env.PORT ? Number(process.env.PORT) : 3000,
	},
	resolve: {
		tsconfigPaths: true,
		alias: {
			"@convex": path.resolve(import.meta.dirname, "convex"),
		},
	},
	plugins: [
		devtools(),
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
