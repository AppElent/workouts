import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { useCallback, useMemo, useState } from "react";
import type { ViewName, ViewResult } from "../types";
import { ExerciseProgress } from "./ExerciseProgress";
import { FoodLog } from "./FoodLog";
import { viewText } from "./i18n";
import { WeekOverview } from "./WeekOverview";

export type ViewProps<Result> = {
	app: App;
	result: Result;
	text: ReturnType<typeof viewText>;
	/** Calls a Foundry tool through the host and shows its result here. */
	reload: (tool: string, args: Record<string, unknown>) => Promise<void>;
	header: React.ReactNode;
};

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

export function ViewRoot({ view }: { view: ViewName }) {
	const [result, setResult] = useState<ViewResult | null>(null);
	const [failed, setFailed] = useState(false);
	const [context, setContext] = useState<McpUiHostContext | undefined>();
	const { app, error } = useApp({
		appInfo: { name: "Foundry", version: "1.0.0" },
		capabilities: { availableDisplayModes: ["inline", "fullscreen"] },
		onAppCreated: (created) => {
			created.ontoolresult = (params) => {
				const content = params.structuredContent as ViewResult | undefined;
				if (params.isError || content?.view !== view) setFailed(true);
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

	const reload = useCallback(
		async (tool: string, args: Record<string, unknown>) => {
			if (!app) return;
			const response = await app.callServerTool({
				name: tool,
				arguments: args,
			});
			const content = response.structuredContent as ViewResult | undefined;
			if (response.isError || content?.view !== view)
				throw new Error(`${tool} failed`);
			setResult(content);
		},
		[app, view],
	);

	const fullscreen = hostContext?.displayMode === "fullscreen";
	if (error || failed)
		return (
			<main className="view" role="alert">
				<p className="muted">{text.t.common.error}</p>
			</main>
		);
	if (!app || !result)
		return (
			<main className="view" aria-busy="true">
				<p className="muted">{text.t.common.waiting}</p>
			</main>
		);
	const header = (
		<FullscreenToggle app={app} context={hostContext} text={text} />
	);
	return (
		<main className={fullscreen ? "view fullscreen" : "view"}>
			{result.view === "week-overview" && (
				<WeekOverview
					app={app}
					result={result}
					text={text}
					reload={reload}
					header={header}
				/>
			)}
			{result.view === "food-log" && (
				<FoodLog
					app={app}
					result={result}
					text={text}
					reload={reload}
					header={header}
				/>
			)}
			{result.view === "exercise-progress" && (
				<ExerciseProgress
					app={app}
					result={result}
					text={text}
					reload={reload}
					header={header}
				/>
			)}
		</main>
	);
}
