import { describe, expect, it } from "vitest";
import { en } from "#/lib/i18n/messages/en";
import { isNavItemLocked, NAV_ITEMS } from "./navItems";

describe("NAV_ITEMS", () => {
	it("marks only /exercises as public (non-gated)", () => {
		const publicRoutes = NAV_ITEMS.filter((i) => !i.gated).map((i) => i.to);
		expect(publicRoutes).toEqual(["/exercises"]);
	});

	it("has a message key with a label and shortLabel for every item", () => {
		for (const item of NAV_ITEMS) {
			const messages = en.nav[item.key];
			expect(messages.label.length).toBeGreaterThan(0);
			expect(messages.shortLabel.length).toBeGreaterThan(0);
		}
	});

	it("includes a gated WODs item pointing at /wods", () => {
		const wods = NAV_ITEMS.find((i) => i.to === "/wods");
		expect(wods).toBeDefined();
		expect(wods?.gated).toBe(true);
	});

	it("includes a gated host item pointing at /hosted-workouts", () => {
		const host = NAV_ITEMS.find((i) => i.to === "/hosted-workouts");
		expect(host).toBeDefined();
		expect(en.nav[host?.key as "hostedWorkouts"].shortLabel).toBe("Host");
		expect(host?.gated).toBe(true);
	});
});

describe("isNavItemLocked", () => {
	it("locks a gated item when signed out", () => {
		expect(isNavItemLocked({ gated: true }, false)).toBe(true);
	});

	it("unlocks a gated item when signed in", () => {
		expect(isNavItemLocked({ gated: true }, true)).toBe(false);
	});

	it("never locks a non-gated item", () => {
		expect(isNavItemLocked({ gated: false }, false)).toBe(false);
		expect(isNavItemLocked({ gated: false }, true)).toBe(false);
	});
});
