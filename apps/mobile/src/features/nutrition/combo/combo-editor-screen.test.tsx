import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { renderApp } from "../../../test-support/render-app";

function nutrients(energy: number): Record<NutrientKey, NutrientValue> {
	const values = Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [key, { kind: "value", amount: 1 }]),
	) as Record<NutrientKey, NutrientValue>;
	values.energy = { kind: "value", amount: energy };
	return values;
}

function oneOff(name: string, energy: number) {
	return {
		reference: { kind: "oneOff" as const },
		snapshot: {
			name: { en: name, nl: name },
			serving: { en: "1 portion", nl: "1 portie" },
			quantity: 1,
			amount: 1,
			baseUnit: "serving" as const,
			nutrients: nutrients(energy),
			provenance: { source: "oneOff" as const },
		},
	};
}

async function openCombo() {
	let id = "";
	const app = renderApp("/nutrition-library", {}, undefined, (stores) => {
		id = stores.personalFoods.createCombo({
			name: "Wrap lunch",
			parts: [oneOff("Wrap", 200), oneOff("Hummus", 141), oneOff("Feta", 141)],
		}).id;
		stores.personalFoods.create({
			name: { en: "Oats", nl: "Havermout" },
			baseUnit: "g",
			nutrients: nutrients(389),
			servings: [],
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: true,
			},
		});
	});
	fireEvent.press(await screen.findByText("Wrap lunch"));
	await waitFor(() => expect(app.getPathname()).toBe(`/nutrition-combo/${id}`));
	return { app, id };
}

describe("combo editor", () => {
	it("shows the total and saves each change at once", async () => {
		const { app, id } = await openCombo();
		expect(await screen.findByText(/^482/)).toBeTruthy();

		fireEvent(screen.getByLabelText(/^Feta, /), "accessibilityAction", {
			nativeEvent: { actionName: "up" },
		});
		await waitFor(() =>
			expect(
				app.repository
					.findCombo(id)
					?.parts.map((part) => part.snapshot.name.en),
			).toEqual(["Wrap", "Feta", "Hummus"]),
		);
	});

	it("removes a part with undo", async () => {
		const { app, id } = await openCombo();
		fireEvent(
			await screen.findByLabelText(/^Hummus, /),
			"accessibilityAction",
			{
				nativeEvent: { actionName: "remove" },
			},
		);
		await waitFor(() =>
			expect(app.repository.findCombo(id)?.parts).toHaveLength(2),
		);
		fireEvent.press(screen.getByLabelText("Undo"));
		await waitFor(() =>
			expect(app.repository.findCombo(id)?.parts).toHaveLength(3),
		);
	});

	it("edits a part's portion in the amount editor", async () => {
		const { app, id } = await openCombo();
		fireEvent.press(await screen.findByLabelText(/^Wrap, /));
		await waitFor(() =>
			expect(app.getPathname()).toBe("/nutrition-combo-part"),
		);
		fireEvent.changeText(await screen.findByLabelText("Quantity"), "2");
		fireEvent.press(screen.getByLabelText("Save"));
		await waitFor(() => {
			const energy =
				app.repository.findCombo(id)?.parts[0].snapshot.nutrients.energy;
			expect(energy).toEqual({ kind: "value", amount: 400 });
		});
		expect(app.repository.findCombo(id)?.parts[0].snapshot.quantity).toBe(2);
	});

	it("adds a food at its default portion from the browser, with undo", async () => {
		const { app, id } = await openCombo();
		fireEvent.press(await screen.findByText("Add part"));
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-food"));
		expect(screen.getByText("to Wrap lunch · 3 parts")).toBeTruthy();
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "oats");
		fireEvent.press((await screen.findAllByLabelText("Add Oats"))[0]);

		await waitFor(() =>
			expect(app.repository.findCombo(id)?.parts).toHaveLength(4),
		);
		const added = app.repository.findCombo(id)?.parts[3];
		expect(added?.reference).toEqual({
			kind: "personal",
			foodId: expect.any(String),
		});
		expect(added?.snapshot.amount).toBe(100);
		// The browser stays open for the next part.
		expect(app.getPathname()).toBe("/nutrition-food");
		fireEvent.press(screen.getByLabelText("Undo"));
		await waitFor(() =>
			expect(app.repository.findCombo(id)?.parts).toHaveLength(3),
		);
	});

	it("adds a food at a chosen portion", async () => {
		const { app, id } = await openCombo();
		fireEvent.press(await screen.findByText("Add part"));
		fireEvent.changeText(
			await screen.findByPlaceholderText("Search foods"),
			"oats",
		);
		// The library underneath lists it too; the browser row is the last match.
		fireEvent.press((await screen.findAllByText("Oats")).at(-1) as never);
		// NEVO's oat flakes come by the 40 g portion.
		fireEvent.changeText(await screen.findByLabelText("Quantity"), "2");
		fireEvent.press(screen.getByLabelText("Add"));

		await waitFor(() =>
			expect(app.repository.findCombo(id)?.parts[3]?.snapshot).toMatchObject({
				quantity: 2,
				amount: 80,
			}),
		);
	});

	it("replaces a part in its place after confirming the portion", async () => {
		const { app, id } = await openCombo();
		fireEvent(
			await screen.findByLabelText(/^Hummus, /),
			"accessibilityAction",
			{ nativeEvent: { actionName: "replace" } },
		);
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-food"));
		// The search starts from the old part's name, under what it was.
		expect(screen.getByDisplayValue("Hummus")).toBeTruthy();
		expect(screen.getByText("Was: 1 portion · 141 kcal")).toBeTruthy();
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "oats");
		expect(await screen.findByText("Choose a replacement")).toBeTruthy();
		// Replacing has no quick +: a tap confirms the portion first.
		expect(screen.queryByLabelText("Add Oats")).toBeNull();
		fireEvent.press((await screen.findAllByText("Oats")).at(-1) as never);
		fireEvent.press((await screen.findAllByLabelText("Save")).at(-1) as never);

		await waitFor(() =>
			expect(
				app.repository
					.findCombo(id)
					?.parts.map((part) => part.snapshot.name.en),
			).toEqual(["Wrap", "Oats", "Feta"]),
		);
		await waitFor(() =>
			expect(app.getPathname()).toBe(`/nutrition-combo/${id}`),
		);
	});

	it("removes a part from its sheet with undo", async () => {
		const { app, id } = await openCombo();
		fireEvent.press(await screen.findByLabelText(/^Feta, /));
		fireEvent.press(await screen.findByLabelText("Remove from combo"));
		await waitFor(() =>
			expect(app.repository.findCombo(id)?.parts).toHaveLength(2),
		);
		fireEvent.press(screen.getByLabelText("Undo"));
		await waitFor(() =>
			expect(app.repository.findCombo(id)?.parts).toHaveLength(3),
		);
	});

	it("shows the new combo total under a changed part", async () => {
		await openCombo();
		fireEvent.press(await screen.findByLabelText(/^Wrap, /));
		expect(
			await screen.findByText(
				"Wrap lunch: 482 kcal. Meals logged earlier stay as they were.",
			),
		).toBeTruthy();
		expect(screen.getByText("This part")).toBeTruthy();
		fireEvent.changeText(screen.getByLabelText("Quantity"), "2");
		expect(
			screen.getByText(
				"Wrap lunch: 482 → 682 kcal. Meals logged earlier stay as they were.",
			),
		).toBeTruthy();
	});

	it("makes the combo a favourite from its menu", async () => {
		await openCombo();
		fireEvent.press(await screen.findByLabelText("More"));
		fireEvent.press(await screen.findByText("Make favourite"));
		fireEvent.press(await screen.findByLabelText("More"));
		expect(await screen.findByText("Remove favourite")).toBeTruthy();
	});
});
