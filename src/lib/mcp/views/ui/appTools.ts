import type { App } from "@modelcontextprotocol/ext-apps";
import { z } from "zod";
import {
	PROGRESS_METRICS,
	PROGRESS_RANGES,
	type ProgressMetric,
	type ProgressRange,
	type ViewName,
	type ViewResult,
} from "../types";

/**
 * App tools: tools the open view offers Claude so it can change what is on
 * screen (Claude docs, MCP Apps "App tools"). They change only the view's own
 * state; writes still go through server tools and the view's buttons.
 */

export type FoodItemInput = {
	foodId: string;
	servingIndex: number;
	quantity: number;
};

/** What a mounted screen lets the app tools do. Each returns text for Claude. */
export type ViewControls = {
	goToWeek?: (weekStart: string) => Promise<string>;
	showExercise?: (exerciseId: string) => Promise<string>;
	goHome?: () => Promise<string>;
	setRange?: (range: ProgressRange) => Promise<string>;
	setMetric?: (metric: ProgressMetric) => Promise<string>;
	addItem?: (item: FoodItemInput) => Promise<string>;
	setQuantity?: (change: {
		foodId: string;
		quantity?: number;
		servingIndex?: number;
	}) => Promise<string>;
	removeItem?: (foodId: string) => Promise<string>;
};

type ControlName = keyof ViewControls;

/**
 * Tools must be registered before `app.connect()`, but what they act on lives
 * in React state that mounts later. Screens publish their controls here; the
 * root view publishes navigation, and the screen on top wins.
 */
export class ControlBridge {
	private layers: Record<"root" | "screen", ViewControls> = {
		root: {},
		screen: {},
	};

	/** Publishes controls and returns the cleanup that withdraws them. */
	set(layer: "root" | "screen", controls: ViewControls) {
		this.layers[layer] = controls;
		return () => {
			if (this.layers[layer] === controls) this.layers[layer] = {};
		};
	}

	get<Name extends ControlName>(name: Name): ViewControls[Name] {
		return this.layers.screen[name] ?? this.layers.root[name];
	}
}

const NOT_SHOWN =
	"That is not on screen in this view right now, so nothing changed.";

export function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

/** A tool's work; an unexpected failure reads as a short error, not a throw. */
async function run(work: Promise<string> | undefined) {
	if (!work) return textResult(NOT_SHOWN);
	try {
		return textResult(await work);
	} catch {
		return {
			...textResult("The view could not make that change. Try again."),
			isError: true,
		};
	}
}

const isoDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.describe("YYYY-MM-DD");
const foodId = z.string().min(1).describe("Food ID from search_foods");
const servingIndex = z
	.number()
	.int()
	.min(0)
	.describe("servingIndex from search_foods");
const quantity = z.number().positive().max(10000);

type ToolSpec = {
	name: string;
	title: string;
	description: string;
	inputSchema: z.ZodObject;
	call: (args: never, bridge: ControlBridge) => Promise<string> | undefined;
};

const GO_TO_WEEK: ToolSpec = {
	name: "go_to_week",
	title: "Go to week",
	description:
		"Show another Monday-to-Sunday week in the open Foundry view. Changes only what is on screen.",
	inputSchema: z.object({
		weekStart: isoDate.describe("Any day in the week to show, YYYY-MM-DD"),
	}),
	call: ({ weekStart }: { weekStart: string }, bridge) =>
		bridge.get("goToWeek")?.(weekStart),
};

const SET_RANGE: ToolSpec = {
	name: "set_range",
	title: "Set progress range",
	description:
		"Change the time range of the exercise progress on screen: 4w, 12w, or 1y. Changes only what is on screen.",
	inputSchema: z.object({ range: z.enum(PROGRESS_RANGES) }),
	call: ({ range }: { range: ProgressRange }, bridge) =>
		bridge.get("setRange")?.(range),
};

const SET_METRIC: ToolSpec = {
	name: "set_metric",
	title: "Set progress metric",
	description:
		"Change the metric of the exercise progress on screen: e1rm (Epley estimate) or topSet (heaviest load). Changes only what is on screen.",
	inputSchema: z.object({ metric: z.enum(PROGRESS_METRICS) }),
	call: ({ metric }: { metric: ProgressMetric }, bridge) =>
		bridge.get("setMetric")?.(metric),
};

const SHOW_EXERCISE: ToolSpec = {
	name: "show_exercise",
	title: "Show exercise",
	description:
		"Show one Exercise's progress in the open Foundry view. Changes only what is on screen.",
	inputSchema: z.object({
		exerciseId: z.string().min(1).describe("Exercise ID from list_exercises"),
	}),
	call: ({ exerciseId }: { exerciseId: string }, bridge) =>
		bridge.get("showExercise")?.(exerciseId),
};

const GO_HOME: ToolSpec = {
	name: "go_home",
	title: "Go to Foundry home",
	description:
		"Show the Foundry home (today, the latest Strength Session, this week) in the open view, refreshed.",
	inputSchema: z.object({}),
	call: (_: never, bridge) => bridge.get("goHome")?.(),
};

const ADD_ITEM: ToolSpec = {
	name: "add_item",
	title: "Add food to review",
	description:
		"Add a food to the food log review on screen. Logs nothing: the user logs from the view.",
	inputSchema: z.object({ foodId, servingIndex, quantity }),
	call: (item: FoodItemInput, bridge) => bridge.get("addItem")?.(item),
};

const SET_QUANTITY: ToolSpec = {
	name: "set_quantity",
	title: "Change food in review",
	description:
		"Change the quantity or serving of a food in the food log review on screen. Logs nothing; logged items cannot change.",
	inputSchema: z.object({
		foodId,
		quantity: quantity.optional(),
		servingIndex: servingIndex.optional(),
	}),
	call: (
		change: { foodId: string; quantity?: number; servingIndex?: number },
		bridge,
	) => bridge.get("setQuantity")?.(change),
};

const REMOVE_ITEM: ToolSpec = {
	name: "remove_item",
	title: "Remove food from review",
	description:
		"Remove a food from the food log review on screen, so Log leaves it out. Logged items cannot be removed here.",
	inputSchema: z.object({ foodId }),
	call: ({ foodId }: { foodId: string }, bridge) =>
		bridge.get("removeItem")?.(foodId),
};

/** The app tools each view offers; home can show the week and progress too. */
export const VIEW_APP_TOOLS: Record<ViewName, readonly ToolSpec[]> = {
	home: [GO_HOME, GO_TO_WEEK, SHOW_EXERCISE, SET_RANGE, SET_METRIC],
	"week-overview": [GO_TO_WEEK],
	"exercise-progress": [SET_RANGE, SET_METRIC],
	"food-log": [ADD_ITEM, SET_QUANTITY, REMOVE_ITEM],
};

/** Call before `app.connect()`, so the view declares the tools capability. */
export function registerViewTools(
	app: Pick<App, "registerTool">,
	view: ViewName,
	bridge: ControlBridge,
) {
	return VIEW_APP_TOOLS[view].map((tool) =>
		app.registerTool(
			tool.name,
			{
				title: tool.title,
				description: tool.description,
				inputSchema: tool.inputSchema,
				annotations: { readOnlyHint: true, openWorldHint: false },
			},
			(args: unknown) => {
				// A control that throws before its first await still reads as an error.
				try {
					return run(tool.call(args as never, bridge));
				} catch {
					return run(Promise.reject(new Error("control failed")));
				}
			},
		),
	);
}

/** What Claude reads after an app tool changed the screen. */
export function describeScreen(result: ViewResult): string {
	switch (result.view) {
		case "home":
			return `Showing Foundry home for ${result.today.date}.`;
		case "week-overview": {
			const { training, nutrition } = result;
			return `Showing the week of ${result.weekStart} to ${result.weekEnd}: ${training.strengthSessions} strength session(s), ${training.runs} run(s), ${training.rides} ride(s); nutrition logged on ${nutrition.loggedDays} day(s).`;
		}
		case "exercise-progress": {
			const { summary } = result;
			return `Showing ${result.exercise.name}, ${result.metric} over ${result.range}: ${summary.sessions} session(s), latest ${summary.latest ?? "none"} ${result.unit}, best ${summary.best ?? "none"} ${result.unit}.`;
		}
		case "food-log":
			return `Showing the food log review for ${result.meal} on ${result.date}.`;
	}
}
