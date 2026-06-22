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
		environment: "jsdom",
		globals: true,
		// Skip stale git worktrees under .claude/ and any leftover module-backup
		// dirs (e.g. node_modules_OLD from a prior package-manager migration) —
		// they carry their own sources/node_modules and pollute the run with
		// thousands of phantom test files and failures.
		exclude: [
			...configDefaults.exclude,
			"**/.claude/**",
			"**/node_modules_OLD/**",
			"**/node_modules.*/**",
		],
	},
});
