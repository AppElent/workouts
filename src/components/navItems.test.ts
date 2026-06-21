import { describe, expect, it } from "vitest";
import { isNavItemLocked, NAV_ITEMS } from "./navItems";

describe("NAV_ITEMS", () => {
	it("marks only /exercises as public (non-gated)", () => {
		const publicRoutes = NAV_ITEMS.filter((i) => !i.gated).map((i) => i.to);
		expect(publicRoutes).toEqual(["/exercises"]);
	});

	it("has a label and shortLabel for every item", () => {
		for (const item of NAV_ITEMS) {
			expect(item.label.length).toBeGreaterThan(0);
			expect(item.shortLabel.length).toBeGreaterThan(0);
		}
	});

	it("includes a gated WODs item pointing at /wods", () => {
		const wods = NAV_ITEMS.find((i) => i.to === "/wods");
		expect(wods).toBeDefined();
		expect(wods?.gated).toBe(true);
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
