/**
 * Types the committed artifact without turning on `resolveJsonModule`.
 *
 * With `resolveJsonModule`, TypeScript infers a literal type for every one of
 * the ~2,300 records in `shipped-foods.json` — a multi-second typecheck and a
 * large memory spike for a shape we already declare by hand. An ambient
 * wildcard declaration gives the precise type at no cost. Bundlers (esbuild,
 * Vite, Metro) resolve the real file at build time regardless.
 */
declare module "*/shipped-foods.json" {
	const artifact: import("./artifact").ShippedArtifact;
	export default artifact;
}
