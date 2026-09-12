/**
 * Correcting a shipped food, driven the way a person does it (#75).
 *
 * Every assertion here is about what the screen shows and what reaches the
 * diary. Nothing looks at how a fork is stored, which SQL runs, or which
 * component rendered — the storage contract is covered at the repository
 * boundary and the ranking rules in `@workouts/core`.
 */
import { useMutation } from "convex/react";
import {
	fireEvent,
	screen,
	testRouter,
	waitFor,
} from "expo-router/testing-library";
import { todayIsoDate } from "../data/calendar-day";
import { renderApp } from "../test-support/render-app";

const mockUseMutation = jest.mocked(useMutation);

/** Open Find Food for a meal and start correcting the promoted apple. */
async function correctTheApple(meal = "Lunch", allFoods = "All foods") {
	fireEvent.press(await screen.findByLabelText(`Add food to ${meal}`));
	fireEvent.press(await screen.findByRole("tab", { name: allFoods }));
	fireEvent.changeText(
		screen.getByPlaceholderText(
			allFoods === "Alle voeding" ? "Zoek eten" : "Search foods",
		),
		allFoods === "Alle voeding" ? "appel" : "apple",
	);
	fireEvent.press(
		await screen.findByText(allFoods === "Alle voeding" ? "Appel" : "Apple"),
	);
	fireEvent.press(await screen.findByText("Correct this food"));
}

describe("correcting a shipped food", () => {
	it("opens Personal Food authoring pre-populated from the shipped food", async () => {
		renderApp();
		await correctTheApple();

		expect(await screen.findByText("Correct a shipped food")).toBeTruthy();
		expect(screen.getByLabelText("Name").props.value).toBe("Apple");
		fireEvent.press(screen.getByLabelText("Edit Dutch name (optional)"));
		expect(screen.getByLabelText("Dutch name").props.value).toBe("Appel");
		expect(
			Number(screen.getByLabelText("Energy per 100 g").props.value),
		).toBeGreaterThan(0);
	});

	it("saves a new food under its own id, leaving the shipped one alone", async () => {
		const { repository } = renderApp();
		await correctTheApple();
		fireEvent.changeText(screen.getByLabelText("Energy per 100 g"), "41");
		fireEvent.press(screen.getByText("Save Personal Food"));

		await screen.findByText("Your correction of Apple w skin av");
		const [fork] = repository.list();
		expect(fork.id).not.toBe("shipped:apple-w-skin-av");
		expect(fork.nutrients.energy).toEqual({ kind: "value", amount: 41 });
		expect(repository.find("shipped:apple-w-skin-av")).toBeUndefined();
	});

	it("records the shipped source, NEVO figures and the local edit", async () => {
		const { repository } = renderApp();
		await correctTheApple();
		fireEvent.changeText(screen.getByLabelText("Energy per 100 g"), "41");
		fireEvent.press(screen.getByText("Save Personal Food"));

		await screen.findByText("Your correction of Apple w skin av");
		expect(repository.list()[0].provenance).toEqual({
			recordOrigin: "personal",
			nutritionSource: "nevo",
			locallyEdited: true,
			forkedFrom: "shipped:apple-w-skin-av",
		});
		expect(screen.getByText("You changed these figures.")).toBeTruthy();
		expect(
			screen.getByText(
				"Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven",
			),
		).toBeTruthy();
	});

	it("does not claim a local edit when nothing was changed", async () => {
		const { repository } = renderApp();
		await correctTheApple();
		fireEvent.press(screen.getByText("Save Personal Food"));

		await screen.findByText("Your correction of Apple w skin av");
		expect(repository.list()[0].provenance.locallyEdited).toBe(false);
		expect(
			screen.getByText("You have not changed these figures yet."),
		).toBeTruthy();
	});

	it("replaces the shipped food in ordinary search", async () => {
		renderApp();
		await correctTheApple();
		fireEvent.changeText(screen.getByLabelText("Name"), "Elstar apple");
		fireEvent.changeText(screen.getByLabelText("Energy per 100 g"), "41");
		fireEvent.press(screen.getByText("Save Personal Food"));
		await screen.findByText("Your correction of Apple w skin av");
		fireEvent.press(screen.getByLabelText("Close serving options"));

		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");

		expect(await screen.findByText("Elstar apple")).toBeTruthy();
		// All foods is the deliberate broader library: it retains the source and
		// marks it as replaced while the correction wins the normal result.
		expect(screen.getByText("Replaced by your correction")).toBeTruthy();
		expect(screen.getAllByText("Apple").length).toBeGreaterThan(0);
	});

	it("keeps the replaced-source provenance visible in All foods", async () => {
		renderApp();
		await correctTheApple();
		fireEvent.press(screen.getByText("Save Personal Food"));
		await screen.findByText("Your correction of Apple w skin av");
		fireEvent.press(screen.getByLabelText("Close serving options"));

		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");
		expect((await screen.findAllByText("Apple")).length).toBeGreaterThan(0);
		expect(screen.getByText("Replaced by your correction")).toBeTruthy();
	});

	it("restores the shipped food when the correction is deleted", async () => {
		const { repository } = renderApp();
		await correctTheApple();
		fireEvent.press(screen.getByText("Save Personal Food"));
		await screen.findByText("Your correction of Apple w skin av");

		fireEvent.press(screen.getByText("Delete Personal Food"));
		expect(await screen.findByText("Delete this correction?")).toBeTruthy();
		expect(
			screen.getByText(
				"The bundled food returns to search. Diary entries keep the nutrition they were logged with.",
			),
		).toBeTruthy();
		const buttons = screen.getAllByText("Delete Personal Food", {
			exact: true,
		});
		fireEvent.press(buttons[buttons.length - 1]);

		await waitFor(() => expect(repository.list()).toEqual([]));
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");
		expect(await screen.findByText("Apple")).toBeTruthy();
	});
});

describe("what a correction does to the diary", () => {
	it("logs the correction under its own id while naming its shipped source", async () => {
		const log = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		const { repository } = renderApp();
		await correctTheApple();
		fireEvent.changeText(screen.getByLabelText("Energy per 100 g"), "41");
		fireEvent.press(screen.getByText("Save Personal Food"));
		await screen.findByText("Your correction of Apple w skin av");

		fireEvent.press(screen.getByText("Add & continue"));

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
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Dinner"));
		fireEvent.press(await screen.findByRole("tab", { name: "All foods" }));
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");
		fireEvent.press(await screen.findByText("Apple"));
		fireEvent.press(screen.getByText("Add & continue"));
		await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
		const before = structuredClone(log.mock.calls[0][0]);
		fireEvent.press(screen.getByText("Done"));

		await correctTheApple("Dinner");
		fireEvent.changeText(screen.getByLabelText("Energy per 100 g"), "41");
		fireEvent.press(screen.getByText("Save Personal Food"));
		await screen.findByText("Your correction of Apple w skin av");

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
		const { repository } = renderApp();
		await correctTheApple();
		fireEvent.changeText(screen.getByLabelText("Energy per 100 g"), "41");
		fireEvent.press(screen.getByText("Save Personal Food"));
		await screen.findByText("Your correction of Apple w skin av");

		fireEvent.press(screen.getByText("Add & continue"));

		expect(
			await screen.findByText(
				"This food could not be logged. Your selection is still here.",
			),
		).toBeTruthy();
		expect(repository.list()[0].provenance.forkedFrom).toBe(
			"shipped:apple-w-skin-av",
		);
		fireEvent.press(screen.getByLabelText("Close serving options"));
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");
		expect(
			await screen.findByText("Your correction of Apple w skin av"),
		).toBeTruthy();
		expect(screen.queryByText("Apple w skin av")).toBeNull();
	});
});

describe("correcting a shipped food in Dutch", () => {
	it("names the correction, its source and its restoration in Dutch", async () => {
		renderApp("/language");
		fireEvent.press(await screen.findByLabelText("Nederlands"));
		testRouter.navigate("/nutrition");
		fireEvent.press(await screen.findByLabelText("Voeg eten toe aan Lunch"));
		fireEvent.press(await screen.findByRole("tab", { name: "Alle voeding" }));
		fireEvent.changeText(screen.getByPlaceholderText("Zoek eten"), "appel");
		fireEvent.press(await screen.findByText("Appel"));

		fireEvent.press(await screen.findByText("Dit voedingsmiddel corrigeren"));
		expect(
			await screen.findByText("Meegeleverd voedingsmiddel corrigeren"),
		).toBeTruthy();
		fireEvent.press(screen.getByText("Persoonlijk voedingsmiddel opslaan"));

		expect(
			await screen.findByText("Jouw correctie van Appel m schil gem"),
		).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Sluit portiekeuze"));
		fireEvent.changeText(screen.getByPlaceholderText("Zoek eten"), "appel");
		fireEvent.press(screen.getByRole("tab", { name: "Alle voeding" }));

		expect(
			await screen.findByText("Vervangen door jouw correctie"),
		).toBeTruthy();
	});
});
