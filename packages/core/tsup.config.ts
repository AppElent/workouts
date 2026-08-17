import { defineConfig } from "tsup";

// ESM-only build to dist/, matching @appelent/auth and @appelent/i18n
// (issue #43, decision 4): this package must satisfy three different
// bundlers — Vite (web), Convex's esbuild (server), and Metro (mobile) —
// and raw .ts subpath exports are unverified against Convex's bundler.
export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
});
