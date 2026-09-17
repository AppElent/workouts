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
	it("saves selected diary entries and replaces them with one Logged Combo", async () => {
		const pendingApply = jest.fn(() => new Promise(() => undefined));
		mockUseMutation.mockImplementation(
			(reference) =>
				(getFunctionName(reference) === "nutritionDiary:applyOperation"
					? pendingApply
					: jest.fn().mockResolvedValue(undefined)) as never,
		);
		showDiary([
			diaryEntry("entry-1", "Apple", "lunch"),
			diaryEntry("entry-2", "Oats", "lunch"),
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

		await screen.findByText("Apple oats");
		expect(screen.queryByText("Apple")).toBeNull();
		expect(screen.queryByText("Oats")).toBeNull();
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

	it("removes the saved Combo when diary replacement cannot be accepted", async () => {
		showDiary([diaryEntry("entry-1", "Oats", "lunch")]);
		const app = renderApp();
		jest.spyOn(app.nutritionRepository, "accept").mockImplementation(() => {
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
		expect(app.repository.listCombos()).toEqual([]);
	});

	it("locks Combo selection to the first selected Meal Slot", async () => {
		showDiary([
			diaryEntry("entry-1", "Apple", "lunch"),
			diaryEntry("entry-2", "Oats", "dinner"),
		]);
		renderApp();
		await screen.findByText("Apple");

		fireEvent.press(screen.getByLabelText("More nutrition tools"));
		fireEvent.press(screen.getByText("Create Combo"));
		fireEvent.press(screen.getByLabelText("Select Apple for Combo"));

		expect(screen.getByLabelText("Select Oats for Combo")).toBeDisabled();
		expect(screen.getByLabelText("Select Oats for Combo")).toHaveStyle({
			opacity: 0.45,
		});
		expect(
			screen.getByText("Only entries from Lunch can be selected."),
		).toBeTruthy();
	});

	it("selects an existing Logged Combo only as one whole group", async () => {
		const group = {
			id: "logged-combo-1",
			comboId: "combo-1",
			name: "Apple oats",
		};
		showDiary([
			{ ...diaryEntry("entry-1", "Apple", "lunch"), comboGroup: group },
			{ ...diaryEntry("entry-2", "Oats", "lunch"), comboGroup: group },
		]);
		renderApp();
		await screen.findByText("Apple oats");

		fireEvent.press(screen.getByLabelText("More nutrition tools"));
		fireEvent.press(screen.getByText("Create Combo"));

		expect(screen.queryByLabelText("Select Apple for Combo")).toBeNull();
		fireEvent.press(
			screen.getByLabelText("Select Logged Combo Apple oats for Combo"),
		);
		expect(screen.getByText("Continue with 2 parts")).toBeEnabled();
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

	it("combines whole and per-part scales and can exclude one part for this log", async () => {
		showDiary([]);
		const logCombo = jest.fn().mockResolvedValue(["entry-1"]);
		mockUseMutation.mockImplementation(
			(reference) =>
				(getFunctionName(reference) === "nutritionDiary:logCombo"
					? logCombo
					: jest.fn().mockResolvedValue(undefined)) as never,
		);
		const app = renderApp();
		const oats = oneOffCombo().parts[0];
		app.repository.createCombo({
			name: "Breakfast",
			parts: [
				{
					...oats,
					snapshot: {
						...oats.snapshot,
						name: { en: "Apple", nl: "Appel" },
					},
				},
				oats,
			],
		});
		await screen.findByText("Today");

		fireEvent.press(screen.getByLabelText("More nutrition tools"));
		fireEvent.press(screen.getByText("Log Combo"));
		fireEvent.press(await screen.findByText("Breakfast"));
		fireEvent.changeText(screen.getByLabelText("Scale this Combo"), "0.5");
		fireEvent.changeText(screen.getByLabelText("Scale Oats"), "2");

		expect(screen.getByText("Final amount: 50 g")).toBeTruthy();
		expect(screen.getByText("Final amount: 100 g")).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Exclude Apple"));
		expect(screen.getByText("Final amount: 50 g")).toBeTruthy();
		fireEvent.press(screen.getByText("Log 1 part"));
		await screen.findByText("Today");

		expect(logCombo).toHaveBeenCalledWith(
			expect.objectContaining({
				parts: [expect.objectContaining({ amount: 100, quantity: 1 })],
			}),
		);
		expect(app.repository.listCombos()[0].parts).toHaveLength(2);
	});

	it("limits multiplier display precision without rounding the logged values", async () => {
		showDiary([]);
		const logCombo = jest.fn().mockResolvedValue(["entry-1"]);
		mockUseMutation.mockImplementation(
			(reference) =>
				(getFunctionName(reference) === "nutritionDiary:logCombo"
					? logCombo
					: jest.fn().mockResolvedValue(undefined)) as never,
		);
		const app = renderApp();
		app.repository.createCombo(oneOffCombo());
		await screen.findByText("Today");

		fireEvent.press(screen.getByLabelText("More nutrition tools"));
		fireEvent.press(screen.getByText("Log Combo"));
		fireEvent.press(await screen.findByText("Morning Combo"));
		const wholeScale = screen.getByLabelText("Scale this Combo");
		const partScale = screen.getByLabelText("Scale Oats");
		fireEvent.changeText(wholeScale, "0.123456");
		fireEvent.changeText(partScale, "2.345678");
		fireEvent(wholeScale, "blur");
		fireEvent(partScale, "blur");

		expect(screen.getByDisplayValue("0.123")).toBeTruthy();
		expect(screen.getByDisplayValue("2.346")).toBeTruthy();
		fireEvent(screen.getByLabelText("Scale this Combo"), "blur");
		fireEvent(screen.getByLabelText("Scale Oats"), "blur");
		fireEvent.press(screen.getByText("Log 1 part"));
		await screen.findByText("Today");
		expect(logCombo.mock.calls[0][0].parts[0].amount).toBeCloseTo(
			100 * 0.123456 * 2.345678,
			10,
		);
	});

	it("resets scales and inclusion and blocks a log with no included parts", async () => {
		showDiary([]);
		const app = renderApp();
		const oats = oneOffCombo().parts[0];
		app.repository.createCombo({
			name: "Breakfast",
			parts: [
				oats,
				{
					...oats,
					snapshot: {
						...oats.snapshot,
						name: { en: "Apple", nl: "Appel" },
					},
				},
			],
		});
		await screen.findByText("Today");

		fireEvent.press(screen.getByLabelText("More nutrition tools"));
		fireEvent.press(screen.getByText("Log Combo"));
		fireEvent.press(await screen.findByText("Breakfast"));
		fireEvent.changeText(screen.getByLabelText("Scale this Combo"), "0.5");
		fireEvent.changeText(screen.getByLabelText("Scale Oats"), "2");
		fireEvent.press(screen.getByLabelText("Exclude Oats"));
		fireEvent.press(screen.getByLabelText("Exclude Apple"));
		expect(screen.getByText("Log 0 parts")).toBeDisabled();

		fireEvent.press(screen.getByText("Reset adjustments"));
		expect(screen.getByLabelText("Scale this Combo").props.value).toBe("");
		expect(screen.getByLabelText("Scale Oats").props.value).toBe("");
		expect(screen.getByLabelText("Exclude Oats")).toBeChecked();
		expect(screen.getByLabelText("Exclude Apple")).toBeChecked();
		expect(screen.getByText("Log 2 parts")).toBeEnabled();
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

	it("temporarily excludes a missing part without repairing the saved Combo", async () => {
		showDiary([]);
		const app = renderApp();
		const available = oneOffCombo().parts[0];
		const combo = app.repository.createCombo({
			name: "Available breakfast",
			parts: [
				available,
				{
					...available,
					reference: { kind: "personal", foodId: "deleted-food" },
					snapshot: {
						...available.snapshot,
						name: { en: "Milk", nl: "Melk" },
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
		fireEvent.press(await screen.findByText("Available breakfast"));
		expect(screen.getByText("Log 2 parts")).toBeDisabled();

		fireEvent.press(screen.getByLabelText("Exclude Milk"));
		expect(screen.getByText("Log 1 part")).toBeEnabled();
		expect(screen.getAllByText("Final amount: 100 g")).toHaveLength(2);
		expect(app.repository.findCombo(combo.id)?.parts).toHaveLength(2);
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
