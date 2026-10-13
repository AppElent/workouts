import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourceRoot = "apps/mobile/src/";
const featureRoot = `${sourceRoot}features/`;
const uiRoot = `${sourceRoot}ui/`;
const messagesRoot = `${sourceRoot}i18n/`;
const routeRoot = "apps/mobile/app";
/** Units and names that read the same in every supported language. */
const UNTRANSLATED = /\b(?:kcal|kg|km|lb|RPE|1RM|WODs?|Foundry)\b/g;
const hasWords = (text) => /\p{L}{3,}/u.test(text.replace(UNTRANSLATED, ""));
/** JSX props that people read or hear; their literal text belongs in the catalog. */
const TEXT_ATTRIBUTES = new Set([
	"accessibilityLabel",
	"accessibilityHint",
	"placeholder",
	"title",
	"label",
	"message",
	"confirmLabel",
	"cancelLabel",
	"retryLabel",
]);

/** Check syntax and direct dependency boundaries; component ownership needs review. */
export function inspectMobileSource(filename, source, resolveImport) {
	const file = filename.replaceAll("\\", "/");
	const feature = file.startsWith(featureRoot);
	const ui = file.startsWith(uiRoot);
	const issues = [];
	if (!file.startsWith(messagesRoot) && /-copy\.tsx?$/.test(file)) {
		issues.push({
			file,
			line: 1,
			rule: "message-catalog",
			message:
				"Put UI text in an i18n/messages/ area module and read it through useI18n().",
		});
	}
	const messages = file.startsWith(messagesRoot);
	if (!feature && !ui && messages) return issues;
	const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
	const report = (node, rule, message) => {
		const line =
			tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
		issues.push({ file, line, rule, message });
	};
	if (
		feature &&
		!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.(?:ios|android|native|web|test|spec))*\.(?:ts|tsx)$/.test(
			path.posix.basename(file),
		)
	) {
		issues.push({
			file,
			line: 1,
			rule: "feature-filename",
			message:
				"Use a kebab-case basename; retain it for platform and test suffixes.",
		});
	}
	const checkDependency = (literal) => {
		if (!ui || !literal || !ts.isStringLiteralLike(literal)) return;
		const target = resolveImport(literal.text, file)?.replaceAll("\\", "/");
		if (target?.startsWith(featureRoot)) {
			report(
				literal,
				"ui-feature-import",
				"Generic UI must not import or re-export feature code.",
			);
		}
	};
	const literalSize = (node) => {
		if (ts.isParenthesizedExpression(node)) return literalSize(node.expression);
		return (
			ts.isNumericLiteral(node) ||
			ts.isStringLiteralLike(node) ||
			(ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand))
		);
	};
	const unwrap = (node) =>
		ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
	const comparesLocale = (condition) => {
		condition = unwrap(condition);
		if (
			!ts.isBinaryExpression(condition) ||
			![
				ts.SyntaxKind.EqualsEqualsEqualsToken,
				ts.SyntaxKind.ExclamationEqualsEqualsToken,
			].includes(condition.operatorToken.kind)
		)
			return false;
		const named = (side) =>
			(ts.isIdentifier(side) || ts.isPropertyAccessExpression(side)) &&
			/locale$/i.test(side.getText(tree));
		const literal = (side) => ts.isStringLiteralLike(side);
		return (
			(named(condition.left) && literal(condition.right)) ||
			(literal(condition.left) && named(condition.right))
		);
	};
	/** Words or sentences, not separators or BCP 47 tags such as "nl-NL". */
	const isText = (node) => {
		node = unwrap(node);
		const text = ts.isStringLiteralLike(node)
			? node.text
			: ts.isTemplateExpression(node)
				? [
						node.head.text,
						...node.templateSpans.map((s) => s.literal.text),
					].join("")
				: undefined;
		return text !== undefined && /\p{L}{3,}|\s/u.test(text);
	};
	const jsx = file.endsWith(".tsx");
	const tests = /(?:^|\/)(?:__tests__|test-support)\/|\.test\.tsx?$/.test(file);
	const literalText = (node) => {
		node = unwrap(node);
		if (ts.isStringLiteralLike(node)) return node.text;
		if (ts.isTemplateExpression(node))
			return [
				node.head.text,
				...node.templateSpans.map((s) => s.literal.text),
			].join(" ");
		return undefined;
	};
	const textAttribute = (node) => {
		if (!TEXT_ATTRIBUTES.has(node.name.getText(tree)) || !node.initializer)
			return false;
		const value = ts.isJsxExpression(node.initializer)
			? node.initializer.expression
			: node.initializer;
		return Boolean(value && branchText(value));
	};
	const wordy = (node) => {
		const text = literalText(node);
		return text !== undefined && hasWords(text);
	};
	/** A rendered `{"…"}`, `{cond ? "…" : x}` or `{cond && "…"}` child. */
	const branchText = (node) => {
		node = unwrap(node);
		if (ts.isConditionalExpression(node))
			return branchText(node.whenTrue) || branchText(node.whenFalse);
		if (
			ts.isBinaryExpression(node) &&
			[
				ts.SyntaxKind.AmpersandAmpersandToken,
				ts.SyntaxKind.BarBarToken,
				ts.SyntaxKind.QuestionQuestionToken,
			].includes(node.operatorToken.kind)
		)
			return (
				(node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken &&
					branchText(node.left)) ||
				branchText(node.right)
			);
		return wordy(node);
	};
	const textProperty = (node) =>
		(ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) &&
		TEXT_ATTRIBUTES.has(node.name.text) &&
		wordy(node.initializer);
	/** `toast.error("…")`, `Alert.alert("…")`, `convexErrorMessage(e, "…")`. */
	const textMessageCall = (node) => {
		const callee = ts.isPropertyAccessExpression(node.expression)
			? node.expression.name.text
			: ts.isIdentifier(node.expression)
				? node.expression.text
				: "";
		return (
			/^(?:error|success|alert|convexErrorMessage)$/.test(callee) &&
			node.arguments.some(wordy)
		);
	};
	const visit = (node) => {
		if (
			!messages &&
			!tests &&
			((ts.isJsxText(node) && hasWords(node.text)) ||
				(ts.isJsxAttribute(node) && textAttribute(node)) ||
				(ts.isJsxExpression(node) &&
					!ts.isJsxAttribute(node.parent) &&
					node.expression &&
					branchText(node.expression)) ||
				(jsx && ts.isPropertyAssignment(node) && textProperty(node)) ||
				(jsx && ts.isCallExpression(node) && textMessageCall(node)))
		)
			report(
				node,
				"hardcoded-ui-text",
				"Put UI text in an i18n/messages/ area module and read it through useI18n().",
			);
		if (
			!messages &&
			ts.isConditionalExpression(node) &&
			comparesLocale(node.condition) &&
			(isText(node.whenTrue) || isText(node.whenFalse))
		)
			report(
				node,
				"inline-locale-text",
				"Put UI text in an i18n/messages/ area module instead of branching on the locale.",
			);
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
			checkDependency(node.moduleSpecifier);
		if (
			ts.isImportEqualsDeclaration(node) &&
			ts.isExternalModuleReference(node.moduleReference)
		)
			checkDependency(node.moduleReference.expression);
		if (
			ts.isCallExpression(node) &&
			(node.expression.kind === ts.SyntaxKind.ImportKeyword ||
				(ts.isIdentifier(node.expression) &&
					node.expression.text === "require"))
		)
			checkDependency(node.arguments[0]);
		if (feature && ts.isPropertyAssignment(node)) {
			const name = ts.isComputedPropertyName(node.name)
				? node.name.expression
				: node.name;
			if (
				(ts.isIdentifier(name) || ts.isStringLiteralLike(name)) &&
				name.text === "fontSize" &&
				literalSize(node.initializer)
			) {
				report(
					node,
					"feature-font-size",
					"Use a shared theme typography token instead of a literal fontSize.",
				);
			}
		}
		if (
			feature &&
			ts.isJsxAttribute(node) &&
			node.name.getText(tree) === "fontSize" &&
			node.initializer
		) {
			const value = ts.isJsxExpression(node.initializer)
				? node.initializer.expression
				: node.initializer;
			if (value && literalSize(value))
				report(
					node,
					"feature-font-size",
					"Use a shared theme typography token instead of a literal fontSize.",
				);
		}
		ts.forEachChild(node, visit);
	};
	visit(tree);
	return issues;
}

export function checkMobileArchitecture(root) {
	const configPath = path.join(root, "apps/mobile/tsconfig.json");
	const config = ts.readConfigFile(configPath, ts.sys.readFile);
	if (config.error)
		throw new Error(
			ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
		);
	const parsed = ts.parseJsonConfigFileContent(
		config.config,
		ts.sys,
		path.dirname(configPath),
	);
	if (parsed.errors.length)
		throw new Error(
			parsed.errors
				.map((error) =>
					ts.flattenDiagnosticMessageText(error.messageText, "\n"),
				)
				.join("\n"),
		);
	const resolveImport = (specifier, file) => {
		const resolved = ts.resolveModuleName(
			specifier,
			path.join(root, file),
			parsed.options,
			ts.sys,
		).resolvedModule;
		return resolved
			? path.relative(root, resolved.resolvedFileName)
			: undefined;
	};
	const scan = (directory) =>
		fs
			.readdirSync(path.join(root, directory), { withFileTypes: true })
			.flatMap((entry) => {
				const file = `${directory}/${entry.name}`;
				if (entry.isDirectory()) return scan(file);
				if (!/\.tsx?$/.test(file)) return [];
				return inspectMobileSource(
					file,
					fs.readFileSync(path.join(root, file), "utf8"),
					resolveImport,
				);
			});
	return [
		...scan(sourceRoot.slice(0, -1)),
		...(fs.existsSync(path.join(root, routeRoot)) ? scan(routeRoot) : []),
	];
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const issues = checkMobileArchitecture(
		path.resolve(import.meta.dirname, ".."),
	);
	for (const issue of issues)
		console.error(
			`${issue.file}:${issue.line} [${issue.rule}] ${issue.message}`,
		);
	if (issues.length) process.exitCode = 1;
	else console.log("Mobile architecture checks passed.");
}
