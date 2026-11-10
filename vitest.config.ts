import viteReact from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [viteReact()],
	resolve: { tsconfigPaths: true },
	test: {
		globals: true,
		// Nested worktrees carry their own sources and node_modules.
		exclude: [...configDefaults.exclude, "**/.worktrees/**", "**/.claude/**"],
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
