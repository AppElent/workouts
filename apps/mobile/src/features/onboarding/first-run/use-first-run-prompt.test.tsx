import { useQuery_experimental } from "convex/react";
import {
	cleanup,
	fireEvent,
	screen,
	waitFor,
} from "expo-router/testing-library";
import { Text } from "react-native";
import * as FirstRunRoute from "../../../../app/(app)/first-run";
import {
	clearPreference,
	PREFERENCE_KEYS,
} from "../../../prefs/local-preference";
import { renderApp } from "../../../test-support/render-app";
import { useFirstRunPrompt } from "./use-first-run-prompt";

const mockAccountQuery = jest.mocked(useQuery_experimental);
const defaultQuery = mockAccountQuery.getMockImplementation();

/** Home mounts the prompt like the tab layout does. */
const routes = {
	index: {
		default: function Home() {
			useFirstRunPrompt();
			return <Text>Home tab</Text>;
		},
	},
	"first-run": FirstRunRoute,
};

/** `account.firstRun` is the only caller of the non-throwing query in these routes. */
function serveAccount(result: ReturnType<typeof useQuery_experimental>) {
	mockAccountQuery.mockReturnValue(result);
}
const emptyAccount = { status: "success", data: { empty: true } } as never;
const usedAccount = { status: "success", data: { empty: false } } as never;

describe("first run prompt", () => {
	beforeEach(() => {
		clearPreference(PREFERENCE_KEYS.firstRunOffered);
	});

	afterEach(() => {
		mockAccountQuery.mockImplementation(defaultQuery);
	});

	it("offers the sheet to a new account", async () => {
		serveAccount(emptyAccount);
		const app = await renderApp("/", routes);

		expect(await screen.findByText("Welcome to Foundry")).toBeTruthy();
		expect(app.getPathname()).toBe("/first-run");
	});

	it("is not shown to an account with goals or history", async () => {
		serveAccount(usedAccount);
		await renderApp("/", routes);

		expect(await screen.findByText("Home tab")).toBeTruthy();
		expect(screen.queryByText("Welcome to Foundry")).toBeNull();
	});

	it("is not offered again on this device after Skip", async () => {
		serveAccount(emptyAccount);
		const app = await renderApp("/", routes);

		await fireEvent.press(await screen.findByRole("button", { name: "Skip" }));
		await waitFor(() => expect(app.getPathname()).toBe("/"));

		await cleanup();
		await renderApp("/", routes);
		expect(await screen.findByText("Home tab")).toBeTruthy();
		expect(screen.queryByText("Welcome to Foundry")).toBeNull();
	});

	it("stays absent when the server cannot answer", async () => {
		serveAccount({
			status: "error",
			error: new Error("Could not find public function"),
		} as never);
		await renderApp("/", routes);

		expect(await screen.findByText("Home tab")).toBeTruthy();
		expect(screen.queryByText("Welcome to Foundry")).toBeNull();
	});
});
