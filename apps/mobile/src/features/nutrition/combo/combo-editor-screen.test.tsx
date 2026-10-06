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
	});
	fireEvent.press(await screen.findByText("Wrap lunch"));
	await waitFor(() => expect(app.getPathname()).toBe(`/nutrition-combo/${id}`));
	return { app, id };
}

describe("combo editor", () => {
	it("shows the total and saves each change at once", async () => {
		const { app, id } = await openCombo();
		expect(await screen.findByText(/^482/)).toBeTruthy();

		fireEvent(screen.getByLabelText(/^Feta/), "accessibilityAction", {
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
		fireEvent(await screen.findByLabelText(/^Hummus/), "accessibilityAction", {
			nativeEvent: { actionName: "remove" },
		});
		await waitFor(() =>
			expect(app.repository.findCombo(id)?.parts).toHaveLength(2),
		);
		fireEvent.press(screen.getByLabelText("Undo"));
		await waitFor(() =>
			expect(app.repository.findCombo(id)?.parts).toHaveLength(3),
		);
	});

	it("scales a part's portion", async () => {
		const { app, id } = await openCombo();
		fireEvent.press(await screen.findByText("Wrap"));
		fireEvent.changeText(screen.getByLabelText("Portion of Wrap"), "2");
		fireEvent.press(screen.getByText("Save"));
		await waitFor(() => {
			const energy =
				app.repository.findCombo(id)?.parts[0].snapshot.nutrients.energy;
			expect(energy).toEqual({ kind: "value", amount: 400 });
		});
	});
});
