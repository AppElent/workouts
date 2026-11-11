import { defineConfig } from "tsup";

// ESM-only build to dist/: this package must satisfy three different
// bundlers — Vite (web), Convex's esbuild (server), and Metro (mobile) —
// and raw .ts subpath exports are unverified against Convex's bundler.
//
// `src/shipped-foods.ts` is a separate entry because it imports the ~500 KB
// shipped-food artifact, and esbuild inlines an imported JSON module into every
// bundle that reaches it. Routing it through the `.` barrel would add the
// artifact to the web bundle and to every Convex function. The two entries
// export disjoint names.
export default defineConfig({
	entry: ["src/index.ts", "src/shipped-foods.ts", "src/exercises/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
});
