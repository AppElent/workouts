import { fireEvent, screen, testRouter } from "expo-router/testing-library";
import Storage from "expo-sqlite/kv-store";
import {
	clearPreference,
	PREFERENCE_KEYS,
	writePreference,
} from "../prefs/local-preference";
import { renderApp } from "../test-support/render-app";

beforeEach(() => {
	clearPreference(PREFERENCE_KEYS.appearance);
	clearPreference(PREFERENCE_KEYS.locale);
});

it("opens from Profile and persists a selection after navigating away", async () => {
	renderApp("/profile");
	fireEvent.press(await screen.findByText("Appearance"));
	fireEvent.press(await screen.findByRole("radio", { name: "Dark" }));
	expect(
		screen.getByRole("radio", { name: "Dark" }).props.accessibilityState
			.checked,
	).toBe(true);
	testRouter.navigate("/nutrition");
	expect(await screen.findByText("Today")).toBeTruthy();
	testRouter.navigate("/appearance");
	expect(
		await screen.findByRole("radio", { name: "Dark", checked: true }),
	).toBeTruthy();
});

it("provides Dutch appearance choices", async () => {
	writePreference(PREFERENCE_KEYS.locale, "nl");
	renderApp("/appearance");
	expect(await screen.findByRole("radio", { name: "Systeem" })).toBeTruthy();
	fireEvent.press(screen.getByRole("radio", { name: "Licht" }));
	expect(
		screen.getByRole("radio", { name: "Licht", checked: true }),
	).toBeTruthy();
});

it("reports a failed preference write while keeping the visible choice", async () => {
	const write = jest.spyOn(Storage, "setItemSync").mockImplementation(() => {
		throw new Error("disk full");
	});
	try {
		renderApp("/appearance");
		fireEvent.press(await screen.findByRole("radio", { name: "Light" }));
		expect(
			await screen.findByText(
				"Appearance changed, but could not be saved. Choose it again to retry.",
			),
		).toBeTruthy();
		expect(
			screen.getByRole("radio", { name: "Light", checked: true }),
		).toBeTruthy();
	} finally {
		write.mockRestore();
	}
});
