/**
 * The bilingual requirement, tested where it is visible: the words on the
 * screen, in both languages, and the absence of a frame in the wrong one.
 */
import { fireEvent, screen, testRouter } from "expo-router/testing-library";
import { PREFERENCE_KEYS, writePreference } from "../prefs/local-preference";
import { renderApp } from "../test-support/render-app";

describe("the app's language", () => {
	it("is reachable from Profile → Preferences", async () => {
		renderApp("/profile");

		fireEvent.press(await screen.findByText("Language"));

		expect(await screen.findByText("Nederlands")).toBeTruthy();
	});

	it("changes the day's words when Dutch is chosen", async () => {
		renderApp("/language");
		fireEvent.press(await screen.findByLabelText("Nederlands"));

		testRouter.navigate("/nutrition");

		expect(await screen.findByText("Vandaag")).toBeTruthy();
		expect(screen.getByText("Ontbijt")).toBeTruthy();
		expect(screen.getByText("Tussendoortjes")).toBeTruthy();
		expect(screen.getByLabelText("Voeg eten toe aan Diner")).toBeTruthy();
	});

	it("paints the first frame in the stored language, never English first", () => {
		// The choice a previous launch wrote. Reading it has to happen during the
		// first render — an effect or an awaited read would paint one English
		// frame before correcting itself, which is the defect this guards.
		writePreference(PREFERENCE_KEYS.locale, "nl");

		renderApp("/nutrition");

		// No `await`, deliberately: this is the first committed frame.
		expect(screen.getByText("Voeding")).toBeTruthy();
		expect(screen.queryByText("Nutrition")).toBeNull();
	});

	it("keeps a chosen language for the next launch", async () => {
		const first = renderApp("/language");
		fireEvent.press(await screen.findByLabelText("Nederlands"));
		first.unmount();

		renderApp("/nutrition");

		expect(screen.getByText("Voeding")).toBeTruthy();
	});

	it("uses Dutch food names and serving labels in the browser", async () => {
		renderApp("/language");
		fireEvent.press(await screen.findByLabelText("Nederlands"));
		testRouter.navigate("/nutrition");
		fireEvent.press(await screen.findByLabelText("Voeg eten toe aan Lunch"));

		expect(await screen.findByText("Zoek eten voor Lunch")).toBeTruthy();
		fireEvent.press(screen.getByText("Appel"));
		expect(await screen.findByText("Appel × 1")).toBeTruthy();
	});

	it("renders the goal editor and validation in Dutch", async () => {
		renderApp("/language");
		fireEvent.press(await screen.findByLabelText("Nederlands"));
		testRouter.navigate("/nutrition-goals");

		expect(await screen.findByText("Jouw voedingsdoelen")).toBeTruthy();
		expect(screen.getByText("Referentie-inname")).toBeTruthy();
		fireEvent.changeText(
			screen.getByLabelText("Energie Minimum Dagelijkse hoeveelheid"),
			"0",
		);
		fireEvent.press(screen.getByText("Doelen opslaan"));
		expect(
			await screen.findByText("Vul een hoeveelheid groter dan nul in."),
		).toBeTruthy();
	});
});
