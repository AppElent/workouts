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
	it("rejects UI text written outside the message catalog", () => {
		const screenFile = "apps/mobile/src/screens/summary.tsx";
		const rules = (source) =>
			inspect(source, screenFile).map((issue) => issue.rule);
		for (const source of [
			"const a = <Text>Workout complete</Text>;",
			'const a = <Input placeholder="Search WODs" />;',
			"const a = <Row accessibilityLabel={`Remove movement $" + "{n}`} />;",
			"const a = <Row accessibilityLabel={open ? `Collapse $" +
				'{n}` : "Expand"} />;',
			'const a = <Text>{busy ? "Saving…" : copy.save}</Text>;',
			'confirm({ title: "Delete this workout?" });',
			'toast.error(convexErrorMessage(error, "Could not delete."));',
		])
			expect(rules(source)).toEqual(["hardcoded-ui-text"]);
	});
	it("allows catalog text, units, separators, platform checks and tests", () => {
		const screenFile = "apps/mobile/src/screens/summary.tsx";
		for (const source of [
			"const a = <Text>{copy.title}</Text>;",
			"const a = <Text>{value} kcal</Text>;",
			"const a = <Row accessibilityLabel={`$" + "{name}, $" + "{detail}`} />;",
			'const a = <>{Platform.OS === "ios" && <Bar />}</>;',
			'const a = <Input placeholder="—" />;',
		])
			expect(inspect(source, screenFile)).toEqual([]);
		expect(
			inspect(
				"const a = <Text>Workout complete</Text>;",
				"apps/mobile/src/screens/summary.test.tsx",
			),
		).toEqual([]);
		expect(
			inspect(
				'errors.push({ key: "range", message: "range" });',
				"apps/mobile/src/data/goal-history.ts",
			),
		).toEqual([]);
	});
	it("rejects per-screen copy dictionaries outside the message catalog", () => {
		for (const file of [
			"apps/mobile/src/screens/activity-copy.ts",
			"apps/mobile/src/features/nutrition/log-food/log-food-copy.ts",
			"apps/mobile/src/ui/sheet-copy.tsx",
		])
			expect(inspect("export const en = {};", file)).toEqual([
				expect.objectContaining({ rule: "message-catalog" }),
			]);
		expect(
			inspect(
				"export const en = {};",
				"apps/mobile/src/i18n/messages/log-food.ts",
			),
		).toEqual([]);
	});
	it("rejects locale branches that choose UI text, outside the catalog", () => {
		for (const source of [
			'const a = locale === "nl" ? "Opslaan" : "Save";',
			// biome-ignore lint/suspicious/noTemplateCurlyInString: fixture source text
			'const b = locale !== "en" ? `${n} items` : `${n} items`;',
			'const c = props.locale === "nl" ? "Kies datum" : undefined;',
		])
			expect(
				inspect(source, "apps/mobile/src/screens/home.tsx").map(
					(issue) => issue.rule,
				),
			).toEqual(["inline-locale-text"]);
		for (const source of [
			'const tag = locale === "nl" ? "nl-NL" : "en-GB";',
			'const sep = locale === "nl" ? "," : ".";',
			'const name = locale === "en" ? serving.en : serving.nl;',
		])
			expect(inspect(source, "apps/mobile/src/screens/home.tsx")).toEqual([]);
		expect(
			inspect(
				'const a = locale === "nl" ? "Opslaan" : "Save";',
				"apps/mobile/src/i18n/index.tsx",
			),
		).toEqual([]);
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
