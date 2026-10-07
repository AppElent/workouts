import {
	ABSENT,
	getShippedFood,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { renderApp } from "../../../test-support/render-app";

const date = "2026-10-04";
const sourceId = "shipped:apple-w-skin-av";
const absent = Object.fromEntries(
	NUTRIENT_KEYS.map((n) => [n, ABSENT]),
) as Record<NutrientKey, NutrientValue>;
function setup(source: "shipped" | "oneOff" = "shipped") {
	const entry = {
		_id: "entry-1",
		date,
		meal: "lunch",
		name: { en: "Apple", nl: "Appel" },
		serving: { en: "Piece × 1", nl: "Stuk × 1" },
		quantity: 1,
		amount: 150,
		baseUnit: "g",
		provenance: source === "shipped" ? { source, sourceId } : { source },
		nutrients: { ...absent, energy: { kind: "value", amount: 77 } },
	};
	jest.mocked(useQuery).mockImplementation((ref, _args?) => {
		const name = getFunctionName(ref);
		if (name === "nutritionGoals:forDate")
			return { goals: [], basis: "reference", effectiveFrom: null };
		if (name === "nutritionDiary:day")
			return {
				entries: [
					entry,
					{
						...entry,
						_id: "entry-2",
						name: { en: "Other apple", nl: "Andere appel" },
					},
				],
				totals: {},
			};
		return [];
	});
	const apply = jest.fn().mockImplementation(() => new Promise(() => {}));
	const other = jest.fn().mockResolvedValue(undefined);
	jest
		.mocked(useMutation)
		.mockImplementation(
			(ref) =>
				(getFunctionName(ref) === "nutritionDiary:applyOperation"
					? apply
					: other) as never,
		);
	const app = renderApp(
		`/nutrition-nutrient-sources?date=${date}&nutrient=fibre`,
	);
	return { app, apply };
}
async function openCorrection() {
	fireEvent.press(await screen.findByText("Apple"));
	await screen.findByLabelText("Fibre (g)");
}
function save() {
	fireEvent.press(screen.getAllByLabelText("Save correction")[0]);
}
it("saves a source Fork and only the selected snapshot, scaling only changed nutrients", async () => {
	const { app } = setup();
	await openCorrection();
	fireEvent.changeText(screen.getByLabelText("Fibre (g)"), "4");
	save();
	await waitFor(() => expect(app.repository.forks()).toHaveLength(1));
	expect(app.repository.findForkOf(sourceId)?.nutrients.fibre).toEqual({
		kind: "value",
		amount: 4,
	});
	const entries = app.nutritionRepository.projectDay("test-user", date).entries;
	expect(entries.find((e) => e._id === "entry-1")?.nutrients).toMatchObject({
		fibre: { kind: "value", amount: 6 },
		energy: { kind: "value", amount: 77 },
	});
	expect(entries.find((e) => e._id === "entry-2")?.nutrients.fibre).toEqual(
		ABSENT,
	);
});
it("can fill a missing snapshot from an already known source value", async () => {
	const { app } = setup();
	await openCorrection();
	expect(screen.getAllByLabelText("Save correction")[0]).toBeEnabled();
	save();
	await waitFor(() => expect(app.repository.forks()).toHaveLength(1));
	const fibre = getShippedFood(sourceId)?.nutrients.fibre;
	expect(fibre?.kind).toBe("value");
	if (fibre?.kind !== "value") throw new Error("Fixture needs known fibre");
	expect(
		app.nutritionRepository
			.projectDay("test-user", date)
			.entries.find((e) => e._id === "entry-1")?.nutrients.fibre,
	).toEqual({ kind: "value", amount: fibre.amount * 1.5 });
});
it("keeps a one-off correction on the entry and distinguishes zero from unknown", async () => {
	const { app } = setup("oneOff");
	await openCorrection();
	fireEvent.changeText(screen.getByLabelText("Fibre (g)"), "-2");
	expect(screen.getAllByLabelText("Save correction")[0]).toBeDisabled();
	fireEvent.changeText(screen.getByLabelText("Fibre (g)"), "0");
	save();
	await waitFor(() =>
		expect(
			app.nutritionRepository
				.projectDay("test-user", date)
				.entries.find((e) => e._id === "entry-1")?.nutrients.fibre,
		).toEqual({ kind: "value", amount: 0 }),
	);
	expect(app.repository.list()).toEqual([]);
});
it("keeps the form after diary persistence fails and reuses the saved Fork on retry", async () => {
	const { app } = setup();
	await openCorrection();
	const accept = jest
		.spyOn(app.nutritionRepository, "accept")
		.mockImplementationOnce(() => {
			throw new Error("disk full");
		});
	fireEvent.changeText(screen.getByLabelText("Fibre (g)"), "4");
	save();
	expect(
		await screen.findByText("Food saved; diary correction failed. Try again."),
	).toBeTruthy();
	expect(screen.getByLabelText("Fibre (g)").props.value).toBe("4");
	expect(app.repository.forks()).toHaveLength(1);
	accept.mockRestore();
	save();
	await waitFor(() =>
		expect(
			app.nutritionRepository
				.projectDay("test-user", date)
				.entries.find((e) => e._id === "entry-1")?.nutrients.fibre,
		).toEqual({ kind: "value", amount: 6 }),
	);
	expect(app.repository.forks()).toHaveLength(1);
});
