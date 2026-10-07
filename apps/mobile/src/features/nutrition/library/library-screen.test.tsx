import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	type PersonalFoodDraft,
} from "@workouts/core/nutrition";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import type { createPersonalFoodRepository } from "../../../data/personal-food-repository";
import { renderApp } from "../../../test-support/render-app";

type Repository = ReturnType<typeof createPersonalFoodRepository>;

function draft(
	name: string,
	options: { recipe?: boolean; energy?: number; brand?: string } = {},
): PersonalFoodDraft {
	const nutrients = Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [key, { kind: "value", amount: 1 }]),
	) as Record<NutrientKey, NutrientValue>;
	nutrients.energy = { kind: "value", amount: options.energy ?? 100 };
	return {
		name: { en: name, nl: name },
		baseUnit: "g",
		nutrients,
		servings: [],
		classification: options.recipe ? "recipe" : "ordinary",
		nutritionBasis: { kind: "per100", unit: "g" },
		provenance: {
			recordOrigin: "personal",
			nutritionSource: options.brand ? "openfoodfacts" : "manual",
			locallyEdited: false,
			brand: options.brand,
		},
	};
}

function seedLibrary(foods: Repository) {
	const oats = foods.create(draft("Oats", { energy: 389 }));
	for (const name of ["Pear", "Plum", "Raisins", "Rice"])
		foods.create(draft(name));
	foods.create(draft("Shake", { brand: "Etos" }));
	foods.create(draft("Lentil soup", { recipe: true }));
	foods.createCombo({
		name: "Breakfast bowl",
		parts: [
			{
				reference: { kind: "personal", foodId: oats.id },
				snapshot: {
					name: oats.name,
					serving: { en: "50 g", nl: "50 g" },
					quantity: 1,
					amount: 50,
					baseUnit: "g",
					nutrients: oats.nutrients,
					provenance: {
						source: "personal",
						sourceId: oats.id,
						nutritionSource: "manual",
						locallyEdited: false,
					},
				},
			},
		],
	});
}

function renderLibrary(seed = true) {
	return renderApp("/nutrition-library", {}, undefined, (stores) => {
		if (seed) seedLibrary(stores.personalFoods);
	});
}

describe("food library", () => {
	it("lists foods, recipes and combos with a preview and show all", async () => {
		renderLibrary();

		expect(await screen.findByText("8 items")).toBeTruthy();
		expect(screen.getByText("Lentil soup")).toBeTruthy();
		expect(screen.getByText("Breakfast bowl")).toBeTruthy();
		expect(screen.queryByText("Shake")).toBeNull();

		fireEvent.press(screen.getByText("Show all 6 foods"));
		expect(await screen.findByText("Shake")).toBeTruthy();
		expect(screen.getByText("OFF · Etos")).toBeTruthy();
		expect(screen.queryByText("Lentil soup")).toBeNull();
	});

	it("names the combos that use a food before deleting it", async () => {
		renderLibrary();
		const oats = await screen.findByLabelText(/^Oats, Own/);
		fireEvent(oats, "accessibilityAction", {
			nativeEvent: { actionName: "delete" },
		});

		expect(
			await screen.findByText(
				"Used in ‘Breakfast bowl’; those combos keep its values. Your diary doesn't change.",
			),
		).toBeTruthy();
		fireEvent.press(screen.getAllByText("Delete").at(-1) as never);
		expect(await screen.findByText("‘Oats’ deleted")).toBeTruthy();
		await waitFor(() => expect(screen.queryByText("Oats")).toBeNull());
	});

	it("makes a combo a favourite like a food", async () => {
		renderLibrary();
		const combo = await screen.findByLabelText(/^Breakfast bowl, /);
		fireEvent(combo, "accessibilityAction", {
			nativeEvent: { actionName: "favorite" },
		});
		expect(await screen.findByText("Breakfast bowl ★")).toBeTruthy();
	});

	it("selects items and deletes them together", async () => {
		renderLibrary();
		fireEvent.press(await screen.findByLabelText("More"));
		fireEvent.press(screen.getAllByText("Select").at(-1) as never);

		fireEvent.press(await screen.findByLabelText("Pear, Select"));
		fireEvent.press(screen.getByLabelText("Plum, Select"));
		expect(screen.getByText("2 selected")).toBeTruthy();

		fireEvent.press(screen.getByLabelText("Delete"));
		fireEvent.press((await screen.findAllByText("Delete")).at(-1) as never);
		expect(await screen.findByText("2 items deleted")).toBeTruthy();
	});

	it("starts empty with three ways in", async () => {
		renderLibrary(false);

		expect(await screen.findByText("Your own foods live here")).toBeTruthy();
		expect(screen.getByText("Scan a barcode")).toBeTruthy();
		expect(screen.getByText("Enter a food")).toBeTruthy();
		expect(screen.getByText("Search Open Food Facts")).toBeTruthy();
	});

	it("creates a food named after a search without results", async () => {
		const app = renderLibrary();
		fireEvent.changeText(
			await screen.findByLabelText("Search library"),
			"Skyr",
		);
		fireEvent.press(await screen.findByText("New food ‘Skyr’"));
		await waitFor(() => expect(app.getPathname()).toBe("/personal-food-new"));
		expect(screen.getByLabelText("Name").props.value).toBe("Skyr");
	});
});
