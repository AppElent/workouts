import path from "node:path";
import viteReact from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [viteReact()],
	resolve: {
		alias: {
			"#": path.resolve(import.meta.dirname, "src"),
			"@": path.resolve(import.meta.dirname, "src"),
			"@convex": path.resolve(import.meta.dirname, "convex"),
		},
	},
	test: {
		globals: true,
		// Nested worktrees and module-backup dirs carry their own sources and
		// node_modules.
		exclude: [
			...configDefaults.exclude,
			"**/.worktrees/**",
			"**/.claude/**",
			"**/node_modules_OLD/**",
			"**/node_modules.*/**",
		],
		projects: [
			{
				extends: true,
				test: {
					name: "scripts",
					include: ["scripts/**/*.test.mjs"],
					environment: "node",
					globals: true,
				},
			},
			{
				extends: true,
				test: {
					name: "convex",
					include: ["convex/**/*.test.ts"],
					environment: "edge-runtime",
					globals: true,
				},
			},
			{
				extends: true,
				test: {
					name: "app",
					include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
					environment: "jsdom",
					globals: true,
				},
			},
			{
				extends: true,
				test: {
					name: "core",
					include: ["packages/core/src/**/*.test.ts"],
					environment: "node",
					globals: true,
				},
			},
		],
	},
});
