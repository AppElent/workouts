import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ViewName, ViewResult } from "../types";
import {
	ControlBridge,
	describeScreen,
	registerViewTools,
	ViewToolError,
} from "./appTools";
import { ExerciseProgress } from "./ExerciseProgress";
import { FoodLog } from "./FoodLog";
import { Home } from "./Home";
import { viewText } from "./i18n";
import { WeekOverview } from "./WeekOverview";

export type ViewProps<Result> = {
	app: App;
	result: Result;
	text: ReturnType<typeof viewText>;
	/** Calls a Foundry tool through the host and shows its result here. */
	reload: (tool: string, args: Record<string, unknown>) => Promise<ViewResult>;
	header: React.ReactNode;
	/** Where the screen publishes what its app tools may do. */
	bridge: ControlBridge;
};

/** Home links to the week and progress views and shows them in place. */
const SHOWS: Record<ViewName, readonly ViewResult["view"][]> = {
	home: ["home", "week-overview", "exercise-progress"],
	"week-overview": ["week-overview"],
	"exercise-progress": ["exercise-progress"],
	"food-log": ["food-log"],
};

export function showsResult(view: ViewName, result: ViewResult | undefined) {
	return !!result && SHOWS[view].includes(result.view);
}

function FullscreenToggle({
	app,
	context,
	text,
}: {
	app: App;
	context: McpUiHostContext | undefined;
	text: ReturnType<typeof viewText>;
}) {
	if (!context?.availableDisplayModes?.includes("fullscreen")) return null;
	const fullscreen = context.displayMode === "fullscreen";
	const label = fullscreen
		? text.t.common.exitFullscreen
		: text.t.common.fullscreen;
	return (
		<button
			type="button"
			className="icon-button"
			aria-label={label}
			title={label}
			onClick={() =>
				void app.requestDisplayMode({
					mode: fullscreen ? "inline" : "fullscreen",
				})
			}
		>
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
				<path
					d={
						fullscreen
							? "M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4"
							: "M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"
					}
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
			</svg>
		</button>
	);
}

function validTimeZone(value: string | undefined) {
	if (!value) return undefined;
	try {
		new Intl.DateTimeFormat("en", { timeZone: value });
		return value;
	} catch {
		return undefined;
	}
}

/** The call that shows `result` again, with the host's time zone added. */
function sameView(
	result: ViewResult,
): [string, Record<string, unknown>] | null {
	if (result.view === "week-overview")
		return ["show_week_overview", { weekStart: result.weekStart }];
	if (result.view === "home") return ["open_foundry", {}];
	if (result.view === "exercise-progress")
		return [
			"show_exercise_progress",
			{
				exerciseId: result.exercise.id,
				range: result.range,
				metric: result.metric,
			},
		];
	return null;
}

export function ViewRoot({ view }: { view: ViewName }) {
	const [result, setResult] = useState<ViewResult | null>(null);
	const [failed, setFailed] = useState(false);
	const [context, setContext] = useState<McpUiHostContext | undefined>();
	const [bridge] = useState(() => new ControlBridge());
	const { app, error } = useApp({
		appInfo: { name: "Foundry", version: "1.0.0" },
		// Inline in the conversation, and the side panel or full screen where
		// the host offers it (Claude: expand button, preferredDisplayMode).
		capabilities: { availableDisplayModes: ["inline", "fullscreen"] },
		onAppCreated: (created) => {
			// Before connect(), so the view declares the tools capability.
			registerViewTools(created, view, bridge);
			created.ontoolresult = (params) => {
				const content = params.structuredContent as ViewResult | undefined;
				if (params.isError || !content || !showsResult(view, content))
					setFailed(true);
				else {
					setFailed(false);
					setResult(content);
				}
			};
			created.addEventListener("hostcontextchanged", (changed) =>
				setContext((previous) => ({
					...(previous ?? created.getHostContext()),
					...changed,
				})),
			);
		},
	});
	useHostStyles(app, app?.getHostContext());
	const hostContext = context ?? app?.getHostContext();
	const text = useMemo(
		() => viewText(hostContext?.locale),
		[hostContext?.locale],
	);

	// The tool call that opened the view cannot know the user's time zone, so
	// the view asks again with the host's once it has one.
	const timeZone = validTimeZone(hostContext?.timeZone);

	const reload = useCallback(
		async (
			tool: string,
			args: Record<string, unknown>,
		): Promise<ViewResult> => {
			if (!app) throw new Error("The view is not connected");
			const response = await app.callServerTool({
				name: tool,
				arguments: timeZone ? { ...args, timeZone } : args,
			});
			const content = response.structuredContent as ViewResult | undefined;
			if (response.isError || !content || !showsResult(view, content)) {
				const text = response.content?.find((block) => block.type === "text");
				throw text && "text" in text && response.isError
					? new ViewToolError(text.text)
					: new Error(`${tool} failed`);
			}
			setResult(content);
			return content;
		},
		[app, view, timeZone],
	);

	// Home navigates between its screens; the screen on top adds its own tools.
	useEffect(() => {
		if (view !== "home") return;
		const show = async (tool: string, args: Record<string, unknown>) =>
			describeScreen(await reload(tool, args));
		return bridge.set("root", {
			goHome: () => show("open_foundry", {}),
			goToWeek: (weekStart) => show("show_week_overview", { weekStart }),
			showExercise: (exerciseId) =>
				show("show_exercise_progress", { exerciseId }),
		});
	}, [view, bridge, reload]);

	const [zoneTried, setZoneTried] = useState<string>();
	const staleZone =
		!!timeZone &&
		!!result &&
		"timeZone" in result &&
		result.timeZone !== timeZone;
	useEffect(() => {
		if (!staleZone || !result || zoneTried === timeZone) return;
		const call = sameView(result);
		if (!call) return;
		// A failed correction leaves the result in the server's zone, which the
		// view then shows as it is.
		void reload(...call)
			.catch(() => undefined)
			.finally(() => setZoneTried(timeZone));
	}, [staleZone, result, timeZone, zoneTried, reload]);

	const fullscreen = hostContext?.displayMode === "fullscreen";
	if (error || failed)
		return (
			<main className="view" role="alert">
				<p className="muted">{text.t.common.error}</p>
			</main>
		);
	// Wait for days in the user's zone rather than flash the server's.
	if (!app || !result || (staleZone && zoneTried !== timeZone))
		return (
			<main className="view" aria-busy="true">
				<p className="muted">{text.t.common.waiting}</p>
			</main>
		);
	const toggle = (
		<FullscreenToggle app={app} context={hostContext} text={text} />
	);
	const header =
		view === "home" && result.view !== "home" ? (
			<>
				<button
					type="button"
					className="icon-button"
					aria-label={text.t.home.back}
					title={text.t.home.back}
					onClick={() => void reload("open_foundry", {}).catch(() => undefined)}
				>
					⌂
				</button>
				{toggle}
			</>
		) : (
			toggle
		);
	const props = { app, text, reload, header, bridge };
	return (
		<main className={fullscreen ? "view fullscreen" : "view"}>
			{result.view === "home" && <Home {...props} result={result} />}
			{result.view === "week-overview" && (
				<WeekOverview {...props} result={result} />
			)}
			{result.view === "food-log" && (
				<FoodLog {...props} key={result.reviewId} result={result} />
			)}
			{result.view === "exercise-progress" && (
				<ExerciseProgress {...props} result={result} />
			)}
		</main>
	);
}
