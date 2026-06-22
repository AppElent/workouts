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
		// Skip stale git worktrees under .claude/ — they carry their own
		// node_modules and pollute the run with phantom failures.
		exclude: [...configDefaults.exclude, "**/.claude/**"],
	},
});
