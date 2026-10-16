/**
 * The bilingual requirement, tested where it is visible: the words on the
 * screen, in both languages, and the absence of a frame in the wrong one.
 */
import { fireEvent, screen, testRouter } from "expo-router/testing-library";
import { PREFERENCE_KEYS, writePreference } from "../prefs/local-preference";
import { renderApp } from "../test-support/render-app";

describe("the app's language", () => {
	it("is reachable from Profile → Preferences", async () => {
		await renderApp("/profile");

		await fireEvent.press(await screen.findByText("Language"));

		expect(await screen.findByText("Nederlands")).toBeTruthy();
	});

	it("changes the day's words when Dutch is chosen", async () => {
		await renderApp("/language");
		await fireEvent.press(await screen.findByLabelText("Nederlands"));

		await testRouter.navigate("/nutrition");

		expect(await screen.findByText("Vandaag")).toBeTruthy();
		expect(screen.getByText("Ontbijt")).toBeTruthy();
		expect(screen.getByText("Tussendoortjes")).toBeTruthy();
		expect(screen.getByText("Geen voedingsdoelen")).toBeTruthy();
		expect(screen.getByText("Doelen instellen")).toBeTruthy();
		expect(screen.getByLabelText("Voeg eten toe aan Diner")).toBeTruthy();
	});

	it("paints the first frame in the stored language, never English first", async () => {
		// The choice a previous launch wrote. Reading it has to happen during the
		// first render — an effect or an awaited read would paint one English
		// frame before correcting itself, which is the defect this guards.
		writePreference(PREFERENCE_KEYS.locale, "nl");

		await renderApp("/nutrition");

		// No `await`, deliberately: this is the first committed frame.
		expect(screen.getByText("Vandaag")).toBeTruthy();
		expect(screen.queryByText("Today")).toBeNull();
	});

	it("keeps a chosen language for the next launch", async () => {
		const first = await renderApp("/language");
		await fireEvent.press(await screen.findByLabelText("Nederlands"));
		await first.unmount();

		await renderApp("/nutrition");

		expect(screen.getByText("Vandaag")).toBeTruthy();
	});

	it("uses Dutch food names and serving labels in the browser", async () => {
		await renderApp("/language");
		await fireEvent.press(await screen.findByLabelText("Nederlands"));
		await testRouter.navigate("/nutrition");
		await fireEvent.press(
			await screen.findByLabelText("Voeg eten toe aan Lunch"),
		);

		// The default "Alles" chip already searches the whole catalogue.
		await fireEvent.changeText(
			await screen.findByLabelText("Zoek eten"),
			"appel",
		);
		await fireEvent.press(screen.getByText("Appel"));
		expect(await screen.findByTestId("amount-editor-card")).toBeTruthy();
		expect(screen.getByLabelText("Aantal").props.value).toBe("1");
		expect(screen.getAllByText("Appel").length).toBeGreaterThan(0);
	});

	it("renders the goal editor and validation in Dutch", async () => {
		await renderApp("/language");
		await fireEvent.press(await screen.findByLabelText("Nederlands"));
		await testRouter.navigate("/nutrition-goals");

		await fireEvent.press(await screen.findByText("Zelf instellen"));
		await fireEvent.changeText(
			await screen.findByLabelText("Energie maximum"),
			"0",
		);
		await fireEvent.press(screen.getByLabelText("Doelen opslaan"));
		expect(
			await screen.findByText("Vul een getal groter dan nul in."),
		).toBeTruthy();
		expect(screen.getByText("1 doel klopt niet")).toBeTruthy();
	});
});
