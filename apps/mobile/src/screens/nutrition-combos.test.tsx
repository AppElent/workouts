import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen } from "expo-router/testing-library";
import type { ComboDraft } from "../data/personal-food-repository";
import { renderApp } from "../test-support/render-app";

const mockUseMutation = jest.mocked(useMutation);
const mockUseQuery = jest.mocked(useQuery);

const nutrients = {
	energy: { kind: "value" as const, amount: 76 },
	protein: { kind: "trace" as const },
	carbs: { kind: "value" as const, amount: 15 },
	fat: { kind: "absent" as const },
	saturatedFat: { kind: "value" as const, amount: 0.1 },
	fibre: { kind: "value" as const, amount: 2.7 },
	sugars: { kind: "value" as const, amount: 13.5 },
	salt: { kind: "value" as const, amount: 0.01 },
};

function diaryEntry(id: string, name: string, meal: "lunch" | "dinner") {
	return {
		_id: id,
		meal,
		name: { en: name, nl: name === "Apple" ? "Appel" : "Havermout" },
		serving: { en: "Portion × 1", nl: "Portie × 1" },
		quantity: 1,
		amount: 100,
		baseUnit: "g" as const,
		nutrients,
		provenance:
			name === "Apple"
				? {
						source: "shipped" as const,
						sourceId: "shipped:apple",
						dataset: "NEVO",
						edition: "2025/9.0",
						sourceCode: 1,
						sourceName: { en: "Apple", nl: "Appel" },
						saltDerived: true,
					}
				: { source: "oneOff" as const },
	};
}

function showDiary(
	entries: Array<
		ReturnType<typeof diaryEntry> & {
			comboGroup?: { id: string; comboId: string; name: string };
		}
	>,
) {
	mockUseQuery.mockImplementation((reference, _args?) =>
		getFunctionName(reference) === "nutritionDiary:day"
			? { entries, totals: {} }
			: [],
	);
}

function oneOffCombo(): ComboDraft {
	const entry = diaryEntry("entry-1", "Oats", "lunch");
	return {
		name: "Morning Combo",
		parts: [
			{
				reference: { kind: "oneOff" },
				snapshot: {
					name: entry.name,
					serving: entry.serving,
					quantity: entry.quantity,
					amount: entry.amount,
					baseUnit: entry.baseUnit,
					nutrients: entry.nutrients,
					provenance: entry.provenance,
				},
			},
		],
	};
}

describe("Nutrition Combos", () => {
	it("saves individually selected diary entries as a named device-local Combo", async () => {
		showDiary([
			diaryEntry("entry-1", "Apple", "lunch"),
			diaryEntry("entry-2", "Oats", "dinner"),
		]);
		const app = renderApp();
		await screen.findByText("Apple");

		fireEvent.press(screen.getByText("Create Combo"));
		expect(screen.queryByLabelText("Select Lunch for Combo")).toBeNull();
		fireEvent.press(screen.getByLabelText("Select Apple for Combo"));
		fireEvent.press(screen.getByLabelText("Select Oats for Combo"));
		fireEvent.press(screen.getByText("Continue with 2 parts"));
		fireEvent.changeText(screen.getByLabelText("Combo name"), "Apple oats");
		fireEvent.press(screen.getByText("Save Combo"));

		await screen.findByText("Today");
		expect(app.repository.listCombos()).toEqual([
			expect.objectContaining({
				name: "Apple oats",
				parts: [
					expect.objectContaining({
						reference: { kind: "shipped", foodId: "shipped:apple" },
					}),
					expect.objectContaining({ reference: { kind: "oneOff" } }),
				],
			}),
		]);
	});

	it("logs all saved parts to the selected day and meal with one action", async () => {
		showDiary([]);
		const logCombo = jest.fn().mockResolvedValue(["entry-1"]);
		mockUseMutation.mockImplementation(
			(reference) =>
				(getFunctionName(reference) === "nutritionDiary:logCombo"
					? logCombo
					: jest.fn().mockResolvedValue(undefined)) as never,
		);
		const app = renderApp();
		const combo = app.repository.createCombo(oneOffCombo());
		await screen.findByText("Today");

		fireEvent.press(screen.getByText("Log Combo"));
		fireEvent.press(await screen.findByText("Morning Combo"));
		fireEvent.press(screen.getByText("Dinner"));
		fireEvent.press(screen.getByText("Log 1 part"));
		await screen.findByText("Today");

		expect(logCombo).toHaveBeenCalledTimes(1);
		expect(logCombo).toHaveBeenCalledWith(
			expect.objectContaining({
				date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
				meal: "dinner",
				combo: { id: combo.id, name: "Morning Combo" },
				parts: [
					expect.objectContaining({ name: { en: "Oats", nl: "Havermout" } }),
				],
			}),
		);
	});

	it("renders a logged Combo collapsed, then exposes each normal entry editor", async () => {
		const group = {
			id: "group-1",
			comboId: "combo-1",
			name: "Apple oats",
		};
		showDiary([
			{ ...diaryEntry("entry-1", "Apple", "lunch"), comboGroup: group },
			{ ...diaryEntry("entry-2", "Oats", "lunch"), comboGroup: group },
		]);
		renderApp();

		expect(await screen.findByText("Apple oats")).toBeTruthy();
		expect(screen.queryByText("Apple")).toBeNull();
		fireEvent.press(screen.getByLabelText("Expand Combo Apple oats"));
		expect(await screen.findByText("Apple")).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Edit entry: Apple"));
		expect(await screen.findByText("Edit entry")).toBeTruthy();
	});

	it("marks a dangling reference and requires explicit deletion instead of logging it", async () => {
		showDiary([]);
		const app = renderApp();
		app.repository.createCombo({
			...oneOffCombo(),
			name: "Old breakfast",
			parts: [
				{
					...oneOffCombo().parts[0],
					reference: { kind: "personal", foodId: "deleted-food" },
					snapshot: {
						...oneOffCombo().parts[0].snapshot,
						provenance: {
							source: "personal",
							sourceId: "deleted-food",
							nutritionSource: "manual",
							locallyEdited: false,
						},
					},
				},
			],
		});
		await screen.findByText("Today");

		fireEvent.press(screen.getByText("Log Combo"));
		fireEvent.press(await screen.findByText("Old breakfast"));

		expect(screen.getByText("Needs attention")).toBeTruthy();
		expect(screen.getByText("Log 1 part")).toBeDisabled();
		expect(screen.getByText("Delete Combo")).toBeTruthy();
	});
});
