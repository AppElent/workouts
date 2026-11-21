import { App } from "@modelcontextprotocol/ext-apps";
import { describe, expect, it, vi } from "vitest";
import { VIEW_NAMES } from "../types";
import { ControlBridge, registerViewTools, VIEW_APP_TOOLS } from "./appTools";

type Registered = {
	inputSchema: {
		"~standard": {
			jsonSchema?: { input: (options: { target: string }) => unknown };
		};
	};
	handler: (
		args: unknown,
		extra: never,
	) => Promise<{ isError?: boolean; content: { text: string }[] }>;
};

function registered(app: App, name: string) {
	return (app as unknown as { _registeredTools: Record<string, Registered> })
		._registeredTools[name];
}

function newApp() {
	return new App({ name: "Foundry", version: "1.0.0" });
}

describe("view app tools", () => {
	it("registers each view's tools and declares the tools capability before connect", () => {
		expect(
			Object.fromEntries(
				VIEW_NAMES.map((view) => [
					view,
					VIEW_APP_TOOLS[view].map((tool) => tool.name),
				]),
			),
		).toEqual({
			home: [
				"go_home",
				"go_to_week",
				"show_exercise",
				"set_range",
				"set_metric",
			],
			"week-overview": ["go_to_week"],
			"exercise-progress": ["set_range", "set_metric"],
			"food-log": ["add_item", "set_quantity", "remove_item"],
		});
		for (const view of VIEW_NAMES) {
			const app = newApp();
			registerViewTools(app, view, new ControlBridge());
			expect(
				(app as unknown as { _capabilities: { tools?: unknown } })._capabilities
					.tools,
			).toEqual({ listChanged: true });
		}
	});

	it("gives every tool a Standard Schema with an object root, as Claude requires", () => {
		const app = newApp();
		const names = new Set(
			VIEW_NAMES.flatMap((view) =>
				VIEW_APP_TOOLS[view].map((tool) => tool.name),
			),
		);
		registerViewTools(app, "home", new ControlBridge());
		registerViewTools(app, "food-log", new ControlBridge());
		for (const name of names) {
			const tool = registered(app, name);
			expect(tool, name).toBeDefined();
			const json = tool.inputSchema["~standard"].jsonSchema?.input({
				target: "draft-2020-12",
			}) as { type: string };
			expect(json.type, name).toBe("object");
			// Claude refuses names outside letters, digits, `.`, `_`, and `-`.
			expect(name).toMatch(/^[A-Za-z0-9._-]{1,128}$/);
		}
	});

	it("answers with text and changes only what the screen on top allows", async () => {
		const app = newApp();
		const bridge = new ControlBridge();
		registerViewTools(app, "home", bridge);
		const goToWeek = registered(app, "go_to_week");
		const setRange = registered(app, "set_range");

		expect(
			(await setRange.handler({ range: "4w" }, {} as never)).content[0].text,
		).toMatch(/not on screen/);

		const root = vi.fn(async () => "root week");
		const screen = vi.fn(async () => "screen week");
		bridge.set("root", { goToWeek: root });
		expect(
			(await goToWeek.handler({ weekStart: "2026-11-16" }, {} as never))
				.content[0].text,
		).toBe("root week");
		const withdraw = bridge.set("screen", { goToWeek: screen });
		await goToWeek.handler({ weekStart: "2026-11-09" }, {} as never);
		expect(screen).toHaveBeenCalledWith("2026-11-09");
		withdraw();
		await goToWeek.handler({ weekStart: "2026-11-02" }, {} as never);
		expect(root).toHaveBeenLastCalledWith("2026-11-02");

		bridge.set("screen", {
			setRange: async () => {
				throw new Error("network");
			},
		});
		const failed = await setRange.handler({ range: "1y" }, {} as never);
		expect(failed.isError).toBe(true);
		expect(failed.content[0].text).toMatch(/could not make that change/);
	});

	it("rejects input outside the schema before any control runs", async () => {
		const app = newApp();
		const bridge = new ControlBridge();
		const setRange = vi.fn(async () => "ok");
		bridge.set("screen", { setRange });
		registerViewTools(app, "exercise-progress", bridge);
		const result = await registered(app, "set_range")
			.handler({ range: "2y" }, {} as never)
			.catch((error: unknown) => ({
				isError: true,
				content: [{ text: String(error) }],
			}));
		expect(result.isError).toBe(true);
		expect(setRange).not.toHaveBeenCalled();
	});
});
