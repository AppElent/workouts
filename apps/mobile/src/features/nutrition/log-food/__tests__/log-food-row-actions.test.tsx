import { useMutation } from "convex/react";
import {
	fireEvent,
	screen,
	waitFor,
	within,
} from "expo-router/testing-library";
import { renderApp } from "../../../../test-support/render-app";

const mockUseMutation = jest.mocked(useMutation);

afterEach(() => jest.restoreAllMocks());

/** The row's own pressable: the element carrying its custom actions. */
async function rowFor(name: string) {
	const title = await screen.findByText(name);
	let node = title.parent;
	while (node && !node.props.accessibilityActions) node = node.parent;
	if (!node) throw new Error(`No actionable row for ${name}`);
	return node;
}

describe("a result row's actions", () => {
	it("offers the full set on long press: log, other portion, favorite and correct", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");
		await screen.findByLabelText("Quick log Apple");

		// iOS: the row's long press is the system context menu.
		const menus = await screen.findAllByTestId("swiftui-context-menu-items");
		const items = within(menus[0])
			.getAllByRole("button")
			.map((button) => button.props.accessibilityLabel);
		expect(items).toEqual([
			expect.stringMatching(/^Log · Apple × 1/),
			"Other portion…",
			"Favorite",
			"Correct…",
		]);
	});

	it("favorites from the row, and the food then appears under Favorites", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");
		fireEvent(await rowFor("Apple"), "accessibilityAction", {
			nativeEvent: { actionName: "favorite" },
		});

		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "");
		fireEvent.press(screen.getByRole("tab", { name: "Favorites" }));
		expect(await screen.findByText("Apple")).toBeTruthy();
	});

	it("logs the remembered portion from the menu, the same as +", async () => {
		const log = jest.fn().mockResolvedValue("entry-1");
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");
		fireEvent(await rowFor("Apple"), "accessibilityAction", {
			nativeEvent: { actionName: "log" },
		});

		await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
		expect(log.mock.calls[0][0]).toMatchObject({ meal: "breakfast" });
	});
});
