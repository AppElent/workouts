import { fileURLToPath } from "node:url";
import viteReact from "@vitejs/plugin-react";
import { build, type Plugin, type Rolldown } from "vite";

const VIRTUAL_ID = "virtual:foundry-mcp-views";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const UI_DIR = fileURLToPath(new URL("./ui/", import.meta.url));
const ENTRY = `${UI_DIR}main.tsx`;

/** Where the server writes the view name into the one shared document. */
export const VIEW_PLACEHOLDER = "__FOUNDRY_VIEW__";

type Bundle = { html: string; files: string[] };

/** Keeps inlined code from closing the tag it sits in. */
function inlineSafe(code: string, tag: "script" | "style") {
	return code.replace(new RegExp(`</(${tag})`, "gi"), "<\\/$1");
}

async function bundleViews(): Promise<Bundle> {
	const output = await build({
		configFile: false,
		root: UI_DIR,
		logLevel: "warn",
		publicDir: false,
		resolve: { tsconfigPaths: true },
		// No NODE_ENV override: the React plugin picks its JSX runtime from the
		// outer NODE_ENV, and React must agree with it (jsxDEV only exists in dev).
		plugins: [viteReact()],
		build: {
			write: false,
			minify: true,
			sourcemap: false,
			modulePreload: false,
			cssCodeSplit: false,
			assetsInlineLimit: Number.POSITIVE_INFINITY,
			rolldownOptions: {
				input: ENTRY,
				output: { format: "es", codeSplitting: false },
			},
		},
	});
	const results = (
		Array.isArray(output) ? output : [output]
	) as Rolldown.RolldownOutput[];
	const files = results.flatMap((result) => result.output);
	const scripts = files.filter(
		(file): file is Rolldown.OutputChunk => file.type === "chunk",
	);
	if (scripts.length !== 1)
		throw new Error(
			`MCP views must build to one script, got ${scripts.length}`,
		);
	const [script] = scripts;
	const css = files
		.filter(
			(file): file is Rolldown.OutputAsset =>
				file.type === "asset" && file.fileName.endsWith(".css"),
		)
		.map((file) => String(file.source))
		.join("\n");
	const html = [
		"<!doctype html>",
		'<html lang="en">',
		"<head>",
		'<meta charset="utf-8">',
		'<meta name="viewport" content="width=device-width, initial-scale=1">',
		"<title>Foundry</title>",
		`<style>${inlineSafe(css, "style")}</style>`,
		"</head>",
		`<body data-view="${VIEW_PLACEHOLDER}">`,
		'<div id="root"></div>',
		`<script type="module">${inlineSafe(script.code, "script")}</script>`,
		"</body>",
		"</html>",
	].join("");
	return {
		html,
		files: script.moduleIds.filter((id) => id.startsWith(UI_DIR)),
	};
}

/**
 * Builds the MCP Apps views (`src/lib/mcp/views/ui/`) into one self-contained
 * HTML document and exposes it to the Worker as `virtual:foundry-mcp-views`.
 * Nothing loads from another origin, so the views need no CSP allowances.
 */
export function foundryMcpViews(): Plugin {
	let bundle: Promise<Bundle> | undefined;
	return {
		name: "foundry-mcp-views",
		resolveId(id) {
			return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
		},
		async load(id) {
			if (id !== RESOLVED_ID) return undefined;
			bundle ??= bundleViews();
			const { html, files } = await bundle;
			for (const file of files) this.addWatchFile(file);
			return [
				`export const VIEW_HTML = ${JSON.stringify(html)};`,
				`export const VIEW_PLACEHOLDER = ${JSON.stringify(VIEW_PLACEHOLDER)};`,
			].join("\n");
		},
		watchChange(id) {
			if (id.startsWith(UI_DIR)) bundle = undefined;
		},
		hotUpdate({ file }) {
			if (!file.startsWith(UI_DIR)) return;
			bundle = undefined;
			const graph = this.environment.moduleGraph;
			const module = graph.getModuleById(RESOLVED_ID);
			if (module) graph.invalidateModule(module);
		},
	};
}
