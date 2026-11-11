import { useMutation } from "convex/react";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { Text } from "react-native";
import * as FirstRunRoute from "../../../../app/(app)/first-run";
import { renderApp } from "../../../test-support/render-app";

const mockUseMutation = jest.mocked(useMutation);

/** Home and Train stand in for the tabs the sheet leads back to. */
const routes = {
	index: { default: () => <Text>Home tab</Text> },
	train: { default: () => <Text>Train tab</Text> },
	"first-run": FirstRunRoute,
};

describe("first run sheet", () => {
	it("leads through goals to the diary", async () => {
		const save = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(
			save as unknown as ReturnType<typeof useMutation>,
		);
		const app = await renderApp("/first-run", routes);

		expect(await screen.findByText("Welcome to Foundry")).toBeTruthy();
		await fireEvent.press(
			screen.getByRole("button", { name: "Set nutrition goals" }),
		);
		await fireEvent.press(await screen.findByText("Choose a starting point"));
		await fireEvent.press(screen.getByLabelText(/^Reference intake,/));
		await fireEvent.press(screen.getByLabelText("Save goals"));

		await waitFor(() => expect(save).toHaveBeenCalled());
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
		expect(screen.queryByText("Welcome to Foundry")).toBeNull();
	});

	it("offers a workout instead of goals", async () => {
		const app = await renderApp("/first-run", routes);

		await fireEvent.press(
			await screen.findByRole("button", {
				name: "Start with a workout instead",
			}),
		);
		await waitFor(() => expect(app.getPathname()).toBe("/train"));
		expect(screen.getByText("Train tab")).toBeTruthy();
	});

	it("skips to a usable app", async () => {
		const app = await renderApp("/first-run", routes);

		await fireEvent.press(await screen.findByRole("button", { name: "Skip" }));
		await waitFor(() => expect(app.getPathname()).toBe("/"));
		expect(screen.queryByText("Welcome to Foundry")).toBeNull();
		expect(screen.getByText("Home tab")).toBeTruthy();
	});
});
