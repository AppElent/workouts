import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen, testRouter } from "expo-router/testing-library";
import type {
	ComboDraft,
	PersonalFoodDraft,
} from "../data/personal-food-repository";
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
	mockUseQuery.mockImplementation((reference, args?) => {
		const name = getFunctionName(reference);
		if (name === "nutritionDiary:day") return { entries, totals: {} };
		if (name === "nutritionGoals:forDate") {
			return {
				goals: [],
				basis: "reference",
				effectiveFrom: (args as { date?: string } | undefined)?.date,
			};
		}
		// Keep the legacy list query available for the goal editor's route tests.
		if (name === "nutritionGoals:list") return [];
		return [];
	});
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

function personalFoodDraft(name: string, energy: number): PersonalFoodDraft {
	return {
		name: { en: name, nl: name },
		baseUnit: "g",
		nutrients: { ...nutrients, energy: { kind: "value", amount: energy } },
		servings: [],
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: true,
		},
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

		fireEvent.press(screen.getByLabelText("More nutrition tools"));
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

	it("keeps the Combo name and selection visible when device saving fails", async () => {
		showDiary([diaryEntry("entry-1", "Oats", "lunch")]);
		const app = renderApp();
		jest.spyOn(app.repository, "createCombo").mockImplementation(() => {
			throw new Error("disk full");
		});
		await screen.findByText("Oats");

		fireEvent.press(screen.getByLabelText("More nutrition tools"));
		fireEvent.press(screen.getByText("Create Combo"));
		fireEvent.press(screen.getByLabelText("Select Oats for Combo"));
		fireEvent.press(screen.getByText("Continue with 1 part"));
		fireEvent.changeText(screen.getByLabelText("Combo name"), "My oats");
		fireEvent.press(screen.getByText("Save Combo"));

		expect(
			await screen.findByText(
				"This Combo could not be saved. Your name and selection are still here.",
			),
		).toBeTruthy();
		expect(screen.getByDisplayValue("My oats")).toBeTruthy();
		expect(screen.getByText("Oats")).toBeTruthy();
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

		fireEvent.press(screen.getByLabelText("More nutrition tools"));
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

	it("resolves the same Personal Food id at logging time without chasing replacements", async () => {
		showDiary([]);
		const logCombo = jest.fn().mockResolvedValue(["entry-1"]);
		mockUseMutation.mockImplementation(
			(reference) =>
				(getFunctionName(reference) === "nutritionDiary:logCombo"
					? logCombo
					: jest.fn().mockResolvedValue(undefined)) as never,
		);
		const app = renderApp();
		const food = app.repository.create(personalFoodDraft("Old oats", 100));
		app.repository.createCombo({
			name: "Current oats",
			parts: [
				{
					reference: { kind: "personal", foodId: food.id },
					snapshot: {
						name: food.name,
						serving: { en: "100 g × 1", nl: "100 g × 1" },
						quantity: 1,
						amount: 100,
						baseUnit: "g",
						nutrients: food.nutrients,
						provenance: {
							source: "personal",
							sourceId: food.id,
							nutritionSource: "manual",
							locallyEdited: true,
						},
					},
				},
			],
		});
		app.repository.update(food.id, personalFoodDraft("Updated oats", 200));
		await screen.findByText("Today");

		fireEvent.press(screen.getByLabelText("More nutrition tools"));
		fireEvent.press(screen.getByText("Log Combo"));
		fireEvent.press(await screen.findByText("Current oats"));
		fireEvent.press(screen.getByText("Log 1 part"));
		await screen.findByText("Today");

		expect(logCombo).toHaveBeenCalledWith(
			expect.objectContaining({
				parts: [
					expect.objectContaining({
						name: { en: "Updated oats", nl: "Updated oats" },
						nutrients: expect.objectContaining({
							energy: { kind: "value", amount: 200 },
						}),
						provenance: expect.objectContaining({ sourceId: food.id }),
					}),
				],
			}),
		);
	});

	it("closes after local acceptance and keeps sync status visible after a network failure", async () => {
		showDiary([]);
		let rejectLog: (reason: Error) => void = () => undefined;
		const pending = new Promise<never>((_resolve, reject) => {
			rejectLog = reject;
		});
		mockUseMutation.mockImplementation(
			(reference) =>
				(getFunctionName(reference) === "nutritionDiary:logCombo"
					? jest.fn(() => pending)
					: jest.fn().mockResolvedValue(undefined)) as never,
		);
		const app = renderApp();
		app.repository.createCombo(oneOffCombo());
		await screen.findByText("Today");
		fireEvent.press(screen.getByLabelText("More nutrition tools"));
		fireEvent.press(screen.getByText("Log Combo"));
		fireEvent.press(await screen.findByText("Morning Combo"));

		fireEvent.press(screen.getByText("Log 1 part"));
		// The release-two service closes at the local SQLite acceptance boundary;
		// it must not hold the form open while the network request is pending.
		expect(await screen.findByText("Today")).toBeTruthy();
		rejectLog(new Error("offline"));

		expect(
			await screen.findByText(
				"1 changes saved on this device; waiting to sync.",
			),
		).toBeTruthy();
		expect(screen.getByText("Retry sync")).toBeTruthy();
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

		fireEvent.press(screen.getByLabelText("More nutrition tools"));
		fireEvent.press(screen.getByText("Log Combo"));
		fireEvent.press(await screen.findByText("Old breakfast"));

		expect(screen.getByText("Needs attention")).toBeTruthy();
		expect(screen.getByText("Log 1 part")).toBeDisabled();
		expect(screen.getByText("Delete Combo")).toBeTruthy();
	});

	it("explicitly resolves a partial dangling Combo by removing unavailable parts", async () => {
		showDiary([]);
		const app = renderApp();
		const oneOff = oneOffCombo().parts[0];
		const combo = app.repository.createCombo({
			name: "Repair me",
			parts: [
				oneOff,
				{
					...oneOff,
					reference: { kind: "personal", foodId: "deleted-food" },
					snapshot: {
						...oneOff.snapshot,
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
		fireEvent.press(screen.getByLabelText("More nutrition tools"));
		fireEvent.press(screen.getByText("Log Combo"));
		fireEvent.press(await screen.findByText("Repair me"));

		fireEvent.press(screen.getByText("Remove unavailable parts"));
		expect(await screen.findByText("Remove unavailable parts?")).toBeTruthy();
		const removeButtons = screen.getAllByText("Remove unavailable parts");
		fireEvent.press(removeButtons[removeButtons.length - 1]);

		expect(await screen.findByText("Log 1 part")).toBeEnabled();
		expect(app.repository.findCombo(combo.id)?.parts).toHaveLength(1);
	});

	it("offers the device-local Combo flow in Dutch", async () => {
		showDiary([]);
		renderApp("/language");
		fireEvent.press(await screen.findByLabelText("Nederlands"));
		testRouter.navigate("/nutrition");

		fireEvent.press(await screen.findByLabelText("Meer voedingsfuncties"));
		expect(await screen.findByText("Combo maken")).toBeTruthy();
		fireEvent.press(screen.getByText("Combo loggen"));
		expect(
			await screen.findByText("Lokale opslag en optionele reservekopie"),
		).toBeTruthy();
		expect(screen.getByText("Nog geen Combo's")).toBeTruthy();
	});
});
