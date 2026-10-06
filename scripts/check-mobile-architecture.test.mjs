import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	checkMobileArchitecture,
	inspectMobileSource,
} from "./check-mobile-architecture.mjs";

const feature =
	"apps/mobile/src/features/nutrition/diary-entry/diary-entry-screen.tsx";
const ui = "apps/mobile/src/ui/menu.tsx";
const resolveImport = (specifier, file) =>
	specifier.startsWith("@features/")
		? `apps/mobile/src/features/${specifier.slice(10)}`
		: path.posix.normalize(
				path.posix.join(path.posix.dirname(file), specifier),
			);
const inspect = (source, file = feature) =>
	inspectMobileSource(file, source, resolveImport);

describe("mobile architecture", () => {
	it("allows shared typography, platform/test filenames, and generic dependencies", () => {
		expect(
			inspect(
				"const style = { ...type.table, fontSize: type.table.fontSize };",
				feature.replace(".tsx", ".ios.test.tsx"),
			),
		).toEqual([]);
		expect(inspect('import { useTokens } from "../theme";', ui)).toEqual([]);
	});
	it("rejects direct feature dependencies including re-exports, require and dynamic imports", () => {
		for (const source of [
			'import X from "../features/nutrition/x";',
			'export { X } from "../features/nutrition/x";',
			'const X = require("../features/nutrition/x");',
			'const X = import("@features/nutrition/x");',
			'import X = require("../features/nutrition/x");',
		])
			expect(inspect(source, ui).map((issue) => issue.rule)).toEqual([
				"ui-feature-import",
			]);
	});
	it("rejects literal sizes in styles and JSX while ignoring comments and text", () => {
		expect(
			inspect(
				'const a = { fontSize: 14, "fontSize": "14", ["fontSize"]: -2 }; const b = <Text fontSize={14} />;',
			),
		).toHaveLength(4);
		expect(inspect('// fontSize: 14\nconst label = "fontSize: 14";')).toEqual(
			[],
		);
	});
	it("rejects camel-case feature filenames and reports useful locations", () => {
		expect(
			inspect(
				"\nconst a = { fontSize: 14 };",
				feature.replace("diary-entry-screen", "DiaryEntry"),
			),
		).toEqual([
			expect.objectContaining({ rule: "feature-filename", line: 1 }),
			expect.objectContaining({ rule: "feature-font-size", line: 2 }),
		]);
	});
	it("leaves legacy screen migration outside this check", () => {
		expect(
			inspect(
				"const a = { fontSize: 14 };",
				"apps/mobile/src/screens/legacy.tsx",
			),
		).toEqual([]);
	});
});

it("resolves real relative and configured alias imports across the filesystem", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "mobile-architecture-"));
	const write = (file, text) => {
		const target = path.join(root, file);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, text);
	};
	try {
		write(
			"apps/mobile/tsconfig.json",
			JSON.stringify({
				compilerOptions: { paths: { "@features/*": ["./src/features/*"] } },
			}),
		);
		write(
			"apps/mobile/src/features/nutrition/item.ts",
			"export const item = 1;",
		);
		write(
			ui,
			'export { item } from "@features/nutrition/item";\nimport { item } from "../features/nutrition/item";',
		);
		expect(checkMobileArchitecture(root).map((issue) => issue.rule)).toEqual([
			"ui-feature-import",
			"ui-feature-import",
		]);
		write(ui, "export const generic = 1;");
		expect(checkMobileArchitecture(root)).toEqual([]);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});
