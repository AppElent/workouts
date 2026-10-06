import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	type PersonalFoodDraft,
} from "@workouts/core/nutrition";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { renderApp } from "../../../test-support/render-app";

function draft(
	servings: PersonalFoodDraft["servings"] = [],
): PersonalFoodDraft {
	const nutrients = Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [key, { kind: "absent" }]),
	) as Record<NutrientKey, NutrientValue>;
	nutrients.energy = { kind: "value", amount: 389 };
	return {
		name: { en: "Oats", nl: "Havermout" },
		baseUnit: "g",
		nutrients,
		servings,
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: false,
		},
	};
}

function type(label: string, text: string) {
	const field = screen.getByLabelText(label);
	fireEvent(field, "focus");
	fireEvent.changeText(screen.getByLabelText(label), text);
	fireEvent(screen.getByLabelText(label), "blur");
}

async function renderExisting(servings?: PersonalFoodDraft["servings"]) {
	let id = "";
	const app = renderApp("/nutrition-library", {}, undefined, (stores) => {
		id = stores.personalFoods.create(draft(servings)).id;
	});
	fireEvent.press(await screen.findByText("Oats"));
	await waitFor(() => expect(app.getPathname()).toBe(`/personal-food/${id}`));
	return { app, id };
}

describe("personal food editor", () => {
	it("creates a food from the new-food sheet", async () => {
		const app = renderApp("/personal-food-new");
		fireEvent.changeText(await screen.findByLabelText("Name"), "Skyr");
		type("Energy", "63");
		type("Protein", "11");
		fireEvent.press(screen.getByLabelText("Save Personal Food"));

		await waitFor(() => expect(app.repository.list()).toHaveLength(1));
		const [saved] = app.repository.list();
		expect(saved.name.en).toBe("Skyr");
		expect(saved.nutrients.energy).toEqual({ kind: "value", amount: 63 });
		expect(saved.nutrients.salt).toEqual({ kind: "absent" });
		expect(saved.visual).toBeUndefined();
	});

	it("replaces a value on the first keystroke and keeps it when left empty", async () => {
		await renderExisting();
		const energy = await screen.findByLabelText("Energy");
		fireEvent(energy, "focus");
		expect(screen.getByLabelText("Energy").props.value).toBe("");
		expect(screen.getByLabelText("Energy").props.placeholder).toBe("389");
		fireEvent(screen.getByLabelText("Energy"), "blur");
		expect(screen.getByLabelText("Energy").props.value).toBe("389");
		expect(screen.getByLabelText("Save Personal Food")).toBeDisabled();
	});

	it("marks a value as trace from above the keyboard", async () => {
		const { app, id } = await renderExisting();
		fireEvent(await screen.findByLabelText("Salt"), "focus");
		fireEvent.press(screen.getByText("Trace"));
		fireEvent.press(screen.getByLabelText("Save Personal Food"));

		await waitFor(() =>
			expect(app.repository.find(id)?.nutrients.salt).toEqual({
				kind: "trace",
			}),
		);
	});

	it("adds more than three servings and moves one to the top", async () => {
		const { app, id } = await renderExisting([
			{ label: { en: "Bowl", nl: "Kom" }, amount: 60 },
			{ label: { en: "Spoon", nl: "Lepel" }, amount: 10 },
			{ label: { en: "Cup", nl: "Kop" }, amount: 80 },
		]);
		fireEvent.press(await screen.findByLabelText("Add serving"));
		fireEvent.changeText(screen.getByLabelText("Serving name"), "Jar");
		fireEvent.changeText(screen.getByLabelText("Serving amount"), "400");
		fireEvent.press(screen.getByText("Add"));

		fireEvent(await screen.findByLabelText(/^Jar,/), "accessibilityAction", {
			nativeEvent: { actionName: "top" },
		});
		fireEvent.press(screen.getByLabelText("Save Personal Food"));

		await waitFor(() =>
			expect(app.repository.find(id)?.servings.map((s) => s.label.en)).toEqual([
				"Jar",
				"Bowl",
				"Spoon",
				"Cup",
			]),
		);
	});

	it("switches to a per-serving basis, which has no servings", async () => {
		const { app, id } = await renderExisting([
			{ label: { en: "Bowl", nl: "Kom" }, amount: 60 },
		]);
		fireEvent.press(await screen.findByLabelText("Nutrition basis"));
		fireEvent.press(screen.getByText("per serving"));
		expect(screen.queryByText("Servings")).toBeNull();
		fireEvent.press(screen.getByLabelText("Save Personal Food"));

		await waitFor(() =>
			expect(app.repository.find(id)?.nutritionBasis.kind).toBe("perServing"),
		);
		expect(app.repository.find(id)?.servings).toEqual([]);
	});

	it("asks for a name before saving", async () => {
		renderApp("/personal-food-new");
		fireEvent.changeText(await screen.findByLabelText("Name"), "x");
		fireEvent.changeText(screen.getByLabelText("Name"), "");
		fireEvent.press(screen.getByLabelText("Save Personal Food"));

		expect(await screen.findByRole("alert")).toBeTruthy();
	});

	it("deletes the food after confirming", async () => {
		const { app, id } = await renderExisting();
		fireEvent.press(await screen.findByLabelText("More"));
		fireEvent.press(screen.getAllByText("Delete").at(-1) as never);
		fireEvent.press((await screen.findAllByText("Delete")).at(-1) as never);

		await waitFor(() => expect(app.repository.find(id)).toBeUndefined());
	});
});
