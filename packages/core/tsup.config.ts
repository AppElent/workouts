import { defineConfig } from "tsup";

// ESM-only build to dist/, matching @appelent/auth and @appelent/i18n
// (issue #43, decision 4): this package must satisfy three different
// bundlers — Vite (web), Convex's esbuild (server), and Metro (mobile) —
// and raw .ts subpath exports are unverified against Convex's bundler.
//
// `src/nutrition/index.ts` is a SECOND entry on purpose (spec #68, D13).
// It pulls in the ~500 KB shipped-food artifact, and esbuild inlines an
// imported JSON module into whichever bundle reaches it. Routing it through
// the `.` barrel would therefore add half a megabyte of Dutch food data to
// the web bundle and to every Convex function — neither of which reads it.
// Keep the barrel and the nutrition entry disjoint.
export default defineConfig({
	entry: ["src/index.ts", "src/nutrition/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
});
