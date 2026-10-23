import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	type PersonalFoodDraft,
} from "@foundry/core/nutrition";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import type { FetchLike } from "../../../data/open-food-facts";
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

async function type(label: string, text: string) {
	const field = screen.getByLabelText(label);
	await fireEvent(field, "focus");
	await fireEvent.changeText(screen.getByLabelText(label), text);
	await fireEvent(screen.getByLabelText(label), "blur");
}

async function renderExisting(servings?: PersonalFoodDraft["servings"]) {
	let id = "";
	const app = await renderApp("/nutrition-library", {}, undefined, (stores) => {
		id = stores.personalFoods.create(draft(servings)).id;
	});
	await fireEvent.press(await screen.findByText("Oats"));
	await waitFor(() => expect(app.getPathname()).toBe(`/personal-food/${id}`));
	return { app, id };
}

const offProduct = {
	code: "5000112637922",
	product_name: "Oats",
	nutriments: { "energy-kcal_100g": 375 },
};

async function renderOffImport(fetchImpl: FetchLike) {
	let id = "";
	const app = await renderApp("/nutrition-library", {}, fetchImpl, (stores) => {
		id = stores.personalFoods.create({
			...draft(),
			provenance: {
				recordOrigin: "import",
				nutritionSource: "openfoodfacts",
				barcode: offProduct.code,
				locallyEdited: false,
			},
		}).id;
	});
	await fireEvent.press(await screen.findByText("Oats"));
	await waitFor(() => expect(app.getPathname()).toBe(`/personal-food/${id}`));
	return { app, id };
}

async function pressRefresh() {
	await fireEvent.press(await screen.findByLabelText("More"));
	await fireEvent.press(
		screen.getAllByText("Refresh from Open Food Facts").at(-1) as never,
	);
}

describe("personal food editor", () => {
	it("creates a food from the new-food sheet", async () => {
		const app = await renderApp("/personal-food-new");
		await fireEvent.changeText(await screen.findByLabelText("Name"), "Skyr");
		await type("Energy", "63");
		await type("Protein", "11");
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));

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
		await fireEvent(energy, "focus");
		expect(screen.getByLabelText("Energy").props.value).toBe("");
		expect(screen.getByLabelText("Energy").props.placeholder).toBe("389");
		await fireEvent(screen.getByLabelText("Energy"), "blur");
		expect(screen.getByLabelText("Energy").props.value).toBe("389");
		expect(screen.getByLabelText("Save Personal Food")).toBeDisabled();
	});

	it("marks a value as trace from above the keyboard", async () => {
		const { app, id } = await renderExisting();
		await fireEvent(await screen.findByLabelText("Salt"), "focus");
		await fireEvent.press(screen.getByText("Trace"));
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));

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
		await fireEvent.press(await screen.findByLabelText("Add serving"));
		await fireEvent.changeText(
			screen.getAllByLabelText("Name").at(-1) as never,
			"Jar",
		);
		await fireEvent.changeText(screen.getByLabelText("Amount"), "400");
		await fireEvent.press(screen.getByText("Add"));

		await fireEvent(
			await screen.findByLabelText(/^Jar,/),
			"accessibilityAction",
			{
				nativeEvent: { actionName: "top" },
			},
		);
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));

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
		await fireEvent.press(await screen.findByLabelText("Nutrition basis"));
		await fireEvent.press(screen.getByText("per serving"));
		expect(screen.queryByText("Servings")).toBeNull();
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));

		await waitFor(() =>
			expect(app.repository.find(id)?.nutritionBasis.kind).toBe("perServing"),
		);
		expect(app.repository.find(id)?.servings).toEqual([]);
	});

	it("asks for a name before saving", async () => {
		await renderApp("/personal-food-new");
		await fireEvent.changeText(await screen.findByLabelText("Name"), "x");
		await fireEvent.changeText(screen.getByLabelText("Name"), "");
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));

		expect(await screen.findByRole("alert")).toBeTruthy();
	});

	it("deletes the food after confirming", async () => {
		const { app, id } = await renderExisting();
		await fireEvent.press(await screen.findByLabelText("More"));
		await fireEvent.press(screen.getAllByText("Delete").at(-1) as never);
		await fireEvent.press(
			(await screen.findAllByText("Delete")).at(-1) as never,
		);

		await waitFor(() => expect(app.repository.find(id)).toBeUndefined());
	});
	it("keeps edits made while a refresh is pending unless replacing is confirmed", async () => {
		let respond = (_: unknown) => {};
		const fetchImpl: FetchLike = jest.fn(
			() =>
				new Promise((resolve) => {
					respond = resolve as never;
				}),
		);
		await renderOffImport(fetchImpl);
		await pressRefresh();
		await type("Energy", "400");
		respond({
			ok: true,
			status: 200,
			json: async () => ({ status: 1, product: offProduct }),
		});

		expect(await screen.findByText("Replace your changes?")).toBeTruthy();
	});

	it("still protects kept values from later refreshes", async () => {
		const fetchImpl: FetchLike = jest.fn(async () => ({
			ok: true,
			status: 200,
			json: async () => ({ status: 1, product: offProduct }),
		}));
		const { app, id } = await renderOffImport(fetchImpl);
		await type("Energy", "400");
		await pressRefresh();
		await fireEvent.press(
			(await screen.findAllByText("Keep my values")).at(-1) as never,
		);
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));

		await waitFor(() =>
			expect(app.repository.find(id)?.provenance.locallyEdited).toBe(true),
		);
		expect(app.repository.find(id)?.nutrients.energy).toEqual({
			kind: "value",
			amount: 400,
		});
	});
});
