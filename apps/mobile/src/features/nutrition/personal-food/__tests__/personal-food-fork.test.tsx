/**
 * Correcting a shipped food, driven the way a person does it (#75).
 *
 * Every assertion here is about what the screen shows and what reaches the
 * diary. Nothing looks at how a fork is stored, which SQL runs, or which
 * component rendered — the storage contract is covered at the repository
 * boundary and the ranking rules in `@foundry/core`.
 */
import { useMutation, usePaginatedQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import {
	fireEvent,
	screen,
	testRouter,
	waitFor,
} from "expo-router/testing-library";
import { todayIsoDate } from "../../../../data/calendar-day";
import {
	PREFERENCE_KEYS,
	writePreference,
} from "../../../../prefs/local-preference";
import { renderApp } from "../../../../test-support/render-app";

const mockUseMutation = jest.mocked(useMutation);

/** Open Find Food for a meal and start correcting the promoted apple. */
async function correctTheApple(meal = "Lunch", allFoods = "Catalogue") {
	await fireEvent.press(await screen.findByLabelText(`Add food to ${meal}`));
	await fireEvent.press(await screen.findByRole("tab", { name: allFoods }));
	await fireEvent.changeText(
		screen.getByPlaceholderText(
			allFoods === "Catalogus" ? "Zoek eten" : "Search foods",
		),
		allFoods === "Catalogus" ? "appel" : "apple",
	);
	await fireEvent.press(
		await screen.findByText(allFoods === "Catalogus" ? "Appel" : "Apple"),
	);
	await sheetMenu("Correct this food");
}

/**
 * The correction's row, topmost first: the amount sheet's Modal stays open over
 * the list, and RNTL 14 no longer hides the list behind it.
 */
async function findCorrection() {
	return (
		await screen.findAllByText(/^Your correction of Apple w skin av( · |$)/)
	).at(-1) as never;
}

/** Opens the amount sheet's ⋯ menu and picks an item. */
async function sheetMenu(label: string) {
	await fireEvent.press(
		(await screen.findAllByLabelText(/^(More|Meer)$/)).at(-1) as never,
	);
	await fireEvent.press((await screen.findAllByText(label)).at(-1) as never);
}

describe("correcting a shipped food", () => {
	it("opens Personal Food authoring pre-populated from the shipped food", async () => {
		await renderApp();
		await correctTheApple();

		expect(await screen.findByLabelText("Name")).toBeTruthy();
		expect(screen.getByLabelText("Name").props.value).toBe("Apple");
		expect(screen.queryByLabelText("Dutch name")).toBeNull();
		expect(Number(screen.getByLabelText("Energy").props.value)).toBeGreaterThan(
			0,
		);
	});

	it("saves a new food under its own id, leaving the shipped one alone", async () => {
		const { repository } = await renderApp();
		await correctTheApple();
		await fireEvent.changeText(screen.getByLabelText("Energy"), "41");
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));

		await findCorrection();
		const [fork] = repository.list();
		expect(fork.id).not.toBe("shipped:apple-w-skin-av");
		expect(fork.nutrients.energy).toEqual({ kind: "value", amount: 41 });
		expect(fork.visual).toEqual({ kind: "icon", preset: "fruit" });
		expect(repository.find("shipped:apple-w-skin-av")).toBeUndefined();
	});

	it("records the shipped source, NEVO figures and the local edit", async () => {
		const { repository } = await renderApp();
		await correctTheApple();
		await fireEvent.changeText(screen.getByLabelText("Energy"), "41");
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));

		await findCorrection();
		expect(repository.list()[0].provenance).toEqual({
			recordOrigin: "personal",
			nutritionSource: "nevo",
			locallyEdited: true,
			forkedFrom: "shipped:apple-w-skin-av",
		});
		expect(screen.getByText("You changed this food.")).toBeTruthy();
		expect(
			screen.getByText(
				"Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven",
			),
		).toBeTruthy();
	});

	it("uses one name and records the resulting local correction", async () => {
		const { repository } = await renderApp();
		await correctTheApple();
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));

		await findCorrection();
		expect(repository.list()[0].name).toEqual({ en: "Apple", nl: "Apple" });
		expect(repository.list()[0].provenance.locallyEdited).toBe(true);
		expect(screen.getByText("You changed this food.")).toBeTruthy();
	});

	it("replaces the shipped food in ordinary search", async () => {
		await renderApp();
		await correctTheApple();
		await fireEvent.changeText(screen.getByLabelText("Name"), "Elstar apple");
		await fireEvent.changeText(screen.getByLabelText("Energy"), "41");
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));
		await findCorrection();
		await fireEvent.press(screen.getByLabelText("Close serving options"));

		await fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"apple",
		);

		expect(await screen.findByText("Elstar apple")).toBeTruthy();
		// The full catalogue is the deliberate broader library: it retains the
		// source and marks it as replaced while the correction wins the pool.
		expect(
			screen.getByText(/^Replaced by your correction( · |$)/),
		).toBeTruthy();
		expect(screen.getAllByText("Apple").length).toBeGreaterThan(0);
	});

	it("keeps the replaced-source provenance visible in the full catalogue", async () => {
		await renderApp();
		await correctTheApple();
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));
		await findCorrection();
		await fireEvent.press(screen.getByLabelText("Close serving options"));

		await fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"apple",
		);
		expect((await screen.findAllByText("Apple")).length).toBeGreaterThan(0);
		expect(
			screen.getByText(/^Replaced by your correction( · |$)/),
		).toBeTruthy();
	});

	it("restores the shipped food when the correction is deleted", async () => {
		const { repository } = await renderApp();
		await correctTheApple();
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));
		await findCorrection();

		await sheetMenu("Delete Personal Food");
		expect(await screen.findByText("Delete this correction?")).toBeTruthy();
		expect(
			screen.getByText(
				"The bundled food returns to search. Diary entries keep the nutrition they were logged with.",
			),
		).toBeTruthy();
		const buttons = screen.getAllByText("Delete Personal Food", {
			exact: true,
		});
		await fireEvent.press(buttons[buttons.length - 1]);

		await waitFor(() => expect(repository.list()).toEqual([]));
		await fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"apple",
		);
		expect(await screen.findByText("Apple")).toBeTruthy();
	});
});

describe("what a correction does to the diary", () => {
	it("logs the correction under its own id while naming its shipped source", async () => {
		const log = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		const { repository } = await renderApp();
		await correctTheApple();
		await fireEvent.changeText(screen.getByLabelText("Energy"), "41");
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));
		await findCorrection();

		await fireEvent.press(screen.getByLabelText("Add & continue"));

		await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
		expect(log.mock.calls[0][0]).toMatchObject({
			date: todayIsoDate(),
			meal: "lunch",
			provenance: {
				source: "personal",
				sourceId: repository.list()[0].id,
				nutritionSource: "nevo",
				locallyEdited: true,
				forkedFrom: "shipped:apple-w-skin-av",
			},
		});
	});

	it("leaves an entry logged before the correction pointing at the shipped food", async () => {
		const log = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		await renderApp();
		await fireEvent.press(await screen.findByLabelText("Add food to Dinner"));
		await fireEvent.press(
			await screen.findByRole("tab", { name: "Catalogue" }),
		);
		await fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"apple",
		);
		await fireEvent.press(await screen.findByText("Apple"));
		await fireEvent.press(screen.getByLabelText("Add & continue"));
		await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
		const before = structuredClone(log.mock.calls[0][0]);
		// There is no "Done" any more — the pushed route's back chevron closes the
		// browser, and every row has already committed its own log.
		await testRouter.back();

		await correctTheApple("Dinner");
		await fireEvent.changeText(screen.getByLabelText("Energy"), "41");
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));
		await findCorrection();

		// The snapshot already written is untouched: same id, same figures. The
		// correction changes what the next search returns, never what history says.
		expect(log.mock.calls[0][0]).toEqual(before);
		expect(before.provenance).toMatchObject({
			source: "shipped",
			sourceId: "shipped:apple-w-skin-av",
		});
	});
});

describe("correcting a shipped food offline", () => {
	it("saves and shadows locally, and keeps the correction after a failed log", async () => {
		// Nothing about a correction needs the network: the shipped library is
		// bundled and the fork is device-local. Only the diary write is remote.
		const log = jest.fn().mockRejectedValue(new Error("offline"));
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		const { repository } = await renderApp();
		await correctTheApple();
		await fireEvent.changeText(screen.getByLabelText("Energy"), "41");
		await fireEvent.press(screen.getByLabelText("Save Personal Food"));
		await findCorrection();

		await fireEvent.press(screen.getByLabelText("Add & continue"));

		expect(
			await screen.findByText(
				"This food could not be logged. Your selection is still here.",
			),
		).toBeTruthy();
		expect(repository.list()[0].provenance.forkedFrom).toBe(
			"shipped:apple-w-skin-av",
		);
		await fireEvent.press(screen.getByLabelText("Close serving options"));
		await fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"apple",
		);
		expect(await findCorrection()).toBeTruthy();
		expect(screen.queryByText("Apple w skin av")).toBeNull();
	});
});

describe("correcting a shipped food in Dutch", () => {
	it("names the correction, its source and its restoration in Dutch", async () => {
		await renderApp("/language");
		await fireEvent.press(await screen.findByLabelText("Nederlands"));
		await testRouter.navigate("/nutrition");
		await fireEvent.press(
			await screen.findByLabelText("Voeg eten toe aan Lunch"),
		);
		await fireEvent.press(
			await screen.findByRole("tab", { name: "Catalogus" }),
		);
		await fireEvent.changeText(
			screen.getByPlaceholderText("Zoek eten"),
			"appel",
		);
		await fireEvent.press(await screen.findByText("Appel"));

		await sheetMenu("Dit voedingsmiddel corrigeren");
		expect(await screen.findByLabelText("Naam")).toBeTruthy();
		await fireEvent.press(
			screen.getByLabelText("Persoonlijk voedingsmiddel opslaan"),
		);

		expect(
			await screen.findByText("Jouw correctie van Appel m schil gem"),
		).toBeTruthy();
		await fireEvent.press(screen.getByLabelText("Sluit portiekeuze"));
		await fireEvent.changeText(
			screen.getByPlaceholderText("Zoek eten"),
			"appel",
		);
		await fireEvent.press(screen.getByRole("tab", { name: "Catalogus" }));

		expect(
			await screen.findByText(/^Vervangen door jouw correctie( · |$)/),
		).toBeTruthy();
	});
});

it("copies supplementary Servings into a correction once", async () => {
	writePreference(PREFERENCE_KEYS.locale, "en");
	jest.mocked(usePaginatedQuery).mockImplementation(
		(ref, _args, _options) =>
			({
				results:
					getFunctionName(ref) === "supplementaryServings:list"
						? [
								{
									id: "addition-1",
									foodId: "shipped:apple-w-skin-av",
									name: "My bowl",
									amount: 187.5,
									unit: "g",
								},
							]
						: [],
				status: "Exhausted",
				loadMore: jest.fn(),
			}) as never,
	);
	await renderApp();
	await correctTheApple();
	expect(await screen.findByText(/My bowl/)).toBeTruthy();
	await fireEvent.press(screen.getByLabelText("Save Personal Food"));
	await findCorrection();
	await fireEvent.press(screen.getByLabelText("Choose serving"));
	expect(screen.getAllByText(/My bowl/).length).toBeGreaterThan(0);
});
