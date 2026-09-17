import { oneOffLogSnapshot } from "./nutrition-one-off";

describe("One-off estimates", () => {
	it("uses servings without invented weights and keeps unknown figures absent", () => {
		const snapshot = oneOffLogSnapshot({
			date: "2026-09-16",
			meal: "lunch",
			name: { en: "Lunch", nl: "Lunch" },
			amount: 1,
			nutrients: {
				energy: { kind: "value", amount: 450 },
				protein: { kind: "trace" },
			},
			clientEntryId: "estimate",
		});
		expect(snapshot).toMatchObject({
			estimated: true,
			baseUnit: "serving",
			amount: 1,
			provenance: { source: "oneOff" },
			nutrients: { protein: { kind: "trace" }, carbs: { kind: "absent" } },
		});
		expect(snapshot.serving.en).not.toContain("Estimated");
	});
	it("keeps explicitly measured units and rejects negative nutrition", () => {
		const input = {
			date: "2026-09-16",
			meal: "breakfast" as const,
			name: { en: "Coffee", nl: "Koffie" },
			amount: 250,
			baseUnit: "ml" as const,
			nutrients: { energy: { kind: "value" as const, amount: 4 } },
			clientEntryId: "coffee",
		};
		expect(oneOffLogSnapshot(input)).toMatchObject({
			baseUnit: "ml",
			estimated: true,
			serving: { en: "250 ml", nl: "250 ml" },
		});
		expect(() =>
			oneOffLogSnapshot({
				...input,
				nutrients: { energy: { kind: "value", amount: -1 } },
			}),
		).toThrow("zero or greater");
	});
});
