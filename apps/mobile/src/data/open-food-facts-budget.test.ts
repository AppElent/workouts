import type { FetchLike } from "./open-food-facts";
import { createOffRequestBudget } from "./open-food-facts-budget";

function okFetch() {
	return jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async () => ({
		ok: true,
		status: 200,
		json: async () => ({}),
	}));
}

describe("the Open Food Facts request budget", () => {
	it("lets six requests through per minute and answers the seventh as rate-limited without calling out", async () => {
		let now = 0;
		const budget = createOffRequestBudget({ now: () => now });
		const network = okFetch();
		const fetch = budget.wrap(network);

		for (let index = 0; index < 6; index += 1) {
			now += 1000;
			expect((await fetch("https://off.test")).status).toBe(200);
		}
		now += 1000;
		expect((await fetch("https://off.test")).status).toBe(429);
		expect(network).toHaveBeenCalledTimes(6);
		// The window opens again a minute after the oldest request.
		expect(budget.coolingUntil()).toBe(61_000);
	});

	it("slides the window instead of resetting it every minute", async () => {
		let now = 0;
		const budget = createOffRequestBudget({ now: () => now });
		const fetch = budget.wrap(okFetch());
		for (let index = 0; index < 6; index += 1) await fetch("https://off.test");
		now = 59_999;
		expect((await fetch("https://off.test")).status).toBe(429);
		now = 60_000;
		expect(budget.coolingUntil()).toBeUndefined();
		expect((await fetch("https://off.test")).status).toBe(200);
	});

	it("cools down for a minute after the provider itself says 429", async () => {
		let now = 5_000;
		const budget = createOffRequestBudget({ now: () => now });
		const network = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(
			async () => ({ ok: false, status: 429, json: async () => ({}) }),
		);
		const fetch = budget.wrap(network);

		expect((await fetch("https://off.test")).status).toBe(429);
		expect(budget.coolingUntil()).toBe(65_000);
		now = 30_000;
		expect((await fetch("https://off.test")).status).toBe(429);
		expect(network).toHaveBeenCalledTimes(1);
		now = 65_000;
		expect(budget.coolingUntil()).toBeUndefined();
	});
});
