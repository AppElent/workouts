import * as ui from "@expo/ui/swift-ui";
import { isValidElement, type ReactNode } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { sessionLiveActivityLayout } from "./live-activity-layout";
import type { LiveActivityProps } from "./live-activity-props";

const { Mask, ProgressView } = ui;
// The mock itself: a namespace import would copy its (missing) keys.
const modifiers = jest.requireMock<Record<string, unknown>>(
	"@expo/ui/swift-ui/modifiers",
);
type Slots = Record<string, ReactNode>;

/**
 * Runs the layout as the widget extension does: the `'widget'` directive
 * compiles it to a source string, evaluated with the UI exports as globals.
 */
function layoutOf(props: LiveActivityProps): Slots {
	const scope = { ...ui, _jsx: jsx, _jsxs: jsxs, _Fragment: Fragment };
	// The modifier mock answers any name; offer it the ones the source uses.
	const modifierScope = new Proxy(
		{},
		{
			has: (_target, name) =>
				typeof name === "string" && name !== "scope" && !(name in globalThis),
			// Strings only: `with` also reads `Symbol.unscopables`.
			get: (_target, name) =>
				typeof name === "string" ? modifiers[name] : undefined,
		},
	);
	const source = sessionLiveActivityLayout as unknown as string;
	const layout = new Function(
		"modifiers",
		"scope",
		`with (modifiers) with (scope) return (${source});`,
	)(modifierScope, scope) as (props: unknown, environment: unknown) => Slots;
	return layout(props, { isStale: false });
}

const T0 = 1_700_000_000_000;
const resting: LiveActivityProps = {
	title: "Push day",
	exercise: "Bench press",
	setLine: "Set 3 of 4",
	loadLine: "80 kg × 8",
	startedAt: T0 - 600_000,
	restEndsAt: T0 + 26_000,
	restFrom: T0,
	restOver: false,
	labels: { rest: "Rest", restOver: "Rest over", next: "Next" },
	colors: { bg: "#000", accent: "#cf0", text: "#fff", muted: "#999" },
};

type Element = { type: unknown; props: Record<string, unknown> };
/** Every element in an unrendered tree, children and slots included. */
function elementsOf(node: ReactNode): Element[] {
	if (Array.isArray(node)) return node.flatMap(elementsOf);
	if (!isValidElement(node)) return [];
	const element = node as unknown as Element;
	return [element, ...elementsOf(element.props.children as ReactNode)];
}

/** The timer gates in a slot: whether each shows its view after the rest ends. */
function gatesOf(node: ReactNode) {
	return elementsOf(node)
		.filter((element) => element.type === Mask.Content)
		.flatMap((content) => elementsOf(content.props.children as ReactNode))
		.filter((element) => element.type === ProgressView)
		.map((gate) => {
			const range = gate.props.timerInterval as { lower: Date; upper: Date };
			return {
				lower: range.lower.getTime(),
				upper: range.upper.getTime(),
				afterEnd: gate.props.countsDown === false,
			};
		});
}

describe("sessionLiveActivityLayout", () => {
	// APP-917: iOS applies the stale date no sooner than ~2 minutes after the
	// last update, so a short rest must flip at its end without one.
	it("swaps the countdown for Rest over at the rest's end without an update", () => {
		const layout = layoutOf(resting);
		const end = resting.restEndsAt as number;
		for (const slot of [
			layout.banner,
			layout.compactTrailing,
			layout.minimal,
			layout.expandedBottom,
		]) {
			expect(gatesOf(slot)).toEqual([
				{ lower: end - 50, upper: end, afterEnd: false },
				{ lower: end - 50, upper: end, afterEnd: true },
			]);
		}
	});

	it("needs no gate once the rest is over or when not resting", () => {
		for (const props of [
			{ ...resting, restEndsAt: null, restOver: true },
			{ ...resting, restEndsAt: null },
		]) {
			const layout = layoutOf(props);
			expect(gatesOf(layout.banner)).toEqual([]);
			expect(gatesOf(layout.compactTrailing)).toEqual([]);
		}
	});
});
