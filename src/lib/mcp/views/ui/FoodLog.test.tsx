// @vitest-environment jsdom
import type { App } from "@modelcontextprotocol/ext-apps";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FoodLogReviewResult, Macros } from "../types";
import { FoodLog } from "./FoodLog";
import { viewText } from "./i18n";

const macros = (energyKcal: number): Macros => ({
	energyKcal,
	proteinG: null,
	carbsG: null,
	fatG: null,
});

const RESULT: FoodLogReviewResult = {
	view: "food-log",
	reviewId: "review-1",
	date: "2026-11-19",
	meal: "dinner",
	canLog: true,
	items: [
		{
			foodId: "shipped:banana",
			name: { en: "Banana", nl: "Banaan" },
			servingIndex: 0,
			quantity: 2,
			servings: [
				{
					servingIndex: 0,
					label: { en: "1 medium", nl: "1 middel" },
					perQuantity: macros(105),
				},
			],
		},
		{
			foodId: "shipped:oats",
			name: { en: "Oats", nl: "Havermout" },
			servingIndex: 0,
			quantity: 1,
			servings: [
				{
					servingIndex: 0,
					label: { en: "40 g", nl: "40 g" },
					perQuantity: macros(150),
				},
			],
		},
	],
	logged: { ...macros(500), entryCount: 1 },
	goals: [],
};

type ToolCall = { name: string; arguments: Record<string, unknown> };
type ToolResponse = {
	isError?: boolean;
	structuredContent?: Record<string, unknown>;
};

function setup(
	respond: (call: ToolCall) => Promise<ToolResponse> | ToolResponse,
	locale?: string,
) {
	const calls: ToolCall[] = [];
	const callServerTool = vi.fn(async (call: ToolCall) => {
		calls.push(call);
		return respond(call);
	});
	const updateModelContext = vi.fn(async () => ({}));
	const app = { callServerTool, updateModelContext } as unknown as App;
	render(
		<FoodLog
			app={app}
			result={RESULT}
			text={viewText(locale)}
			reload={async () => undefined}
			header={null}
		/>,
	);
	return { calls, updateModelContext };
}

const ok = (call: ToolCall): ToolResponse => ({
	structuredContent: { entryId: `entry-${call.arguments.foodId}` },
});
const failed: ToolResponse = { isError: true };

const logButton = () => screen.getByRole("button", { name: /^Log 2 items$/ });
const sentContext = (spy: ReturnType<typeof vi.fn>, call: number) => {
	const [message] = spy.mock.calls[call] as [{ content: { text: string }[] }];
	return message.content[0].text;
};

afterEach(cleanup);

describe("food log view", () => {
	it("locks every control while logging, then repeats all saved items after a retry", async () => {
		let releaseBanana: (response: ToolResponse) => void = () => undefined;
		let oatsAttempts = 0;
		const { calls, updateModelContext } = setup((call) => {
			if (call.arguments.foodId === "shipped:banana")
				return new Promise<ToolResponse>((resolve) => {
					releaseBanana = resolve;
				});
			oatsAttempts += 1;
			return oatsAttempts === 1 ? failed : ok(call);
		});

		fireEvent.click(logButton());
		await waitFor(() => expect(calls).toHaveLength(1));

		// Logging: the first write is still in flight.
		const busy = screen.getByRole("button", { name: "Logging…" });
		expect((busy as HTMLButtonElement).disabled).toBe(true);
		for (const field of [
			...screen.getAllByRole("spinbutton"),
			...screen.getAllByRole("combobox"),
		])
			expect((field as HTMLInputElement | HTMLSelectElement).disabled).toBe(
				true,
			);
		expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();

		releaseBanana(ok(calls[0]));
		await screen.findByText("Not saved");
		expect(screen.getByText("✓ Saved")).toBeTruthy();
		expect(updateModelContext).toHaveBeenCalledTimes(1);
		expect(sentContext(updateModelContext, 0)).toContain(
			"logged 1 item(s) to dinner on 2026-11-19: 2 × 1 medium Banana.",
		);

		// Retry only the failed item, with its first key.
		const retry = screen.getByRole("button", { name: "Retry unsaved items" });
		expect((retry as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(retry);
		await screen.findByText("Logged to your Nutrition Diary.");
		expect(calls.map((call) => call.arguments.idempotencyKey)).toEqual([
			"review-1:0",
			"review-1:1",
			"review-1:1",
		]);
		expect(updateModelContext).toHaveBeenCalledTimes(2);
		const second = sentContext(updateModelContext, 1);
		expect(second).toContain("logged 2 item(s)");
		expect(second).toContain("2 × 1 medium Banana; 1 × 40 g Oats");
	});

	it("shows a refused edit instead of the generic failure", async () => {
		setup((call) =>
			call.arguments.foodId === "shipped:oats"
				? {
						isError: true,
						structuredContent: { error: { code: "operationConflict" } },
					}
				: ok(call),
		);
		fireEvent.click(logButton());
		await screen.findByText(
			/Foundry already has this item with another amount/,
		);
	});

	it("flags an invalid quantity and holds back Log until it is fixed", async () => {
		const { calls } = setup(ok);
		const banana = screen.getByLabelText("Quantity of Banana");
		fireEvent.change(banana, { target: { value: "0" } });
		expect(screen.getByRole("alert").textContent).toContain("above 0");
		expect(banana.getAttribute("aria-invalid")).toBe("true");
		expect((logButton() as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(logButton());
		expect(calls).toHaveLength(0);

		fireEvent.change(banana, { target: { value: "3" } });
		expect(screen.queryByRole("alert")).toBeNull();
		fireEvent.click(logButton());
		await screen.findByText("Logged to your Nutrition Diary.");
		expect(calls[0].arguments.quantity).toBe(3);
	});

	it("does not let a dropped item come back once something is saved", async () => {
		const { calls } = setup(ok);
		fireEvent.click(screen.getByRole("button", { name: "Remove Oats" }));
		expect(screen.getByRole("button", { name: "Put Oats back" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Log 1 item" }));
		await screen.findByText("Logged to your Nutrition Diary.");
		expect(calls).toHaveLength(1);
		expect(screen.queryByRole("button", { name: "Put Oats back" })).toBeNull();
	});

	it("shows food names in the host's language", () => {
		setup(ok, "nl");
		expect(screen.getByText("Banaan")).toBeTruthy();
		expect(screen.getByText("Havermout")).toBeTruthy();
	});
});
