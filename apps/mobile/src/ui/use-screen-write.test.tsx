import { fireEvent, screen } from "@testing-library/react-native";
import { ConvexError } from "convex/values";
import { Pressable, Text } from "react-native";
import { renderScreen } from "../test-support/render-screen";
import { useScreenWrite } from "./use-screen-write";

function SaveButton({ write }: { write: () => Promise<unknown> }) {
	const { run, busy } = useScreenWrite();
	return (
		<Pressable onPress={() => void run("Could not save.", write)}>
			<Text>{busy ? "Saving" : "Save"}</Text>
		</Pressable>
	);
}

describe("useScreenWrite", () => {
	it("explains a coded server failure from the catalog", async () => {
		await renderScreen(
			<SaveButton
				write={() => Promise.reject(new ConvexError({ code: "recordDeleted" }))}
			/>,
		);
		fireEvent.press(screen.getByText("Save"));
		expect(
			await screen.findByText("This was deleted on another device."),
		).toBeTruthy();
	});

	it("shows the screen's message for a local failure", async () => {
		await renderScreen(
			<SaveButton
				write={() => Promise.reject(new Error("A connection is required."))}
			/>,
		);
		fireEvent.press(screen.getByText("Save"));
		expect(await screen.findByText("Could not save.")).toBeTruthy();
		expect(screen.queryByText("A connection is required.")).toBeNull();
	});

	it("ignores a second press while the first write runs", async () => {
		let finish = () => {};
		const write = jest.fn(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		await renderScreen(<SaveButton write={write} />);
		fireEvent.press(screen.getByText("Save"));
		fireEvent.press(await screen.findByText("Saving"));
		expect(write).toHaveBeenCalledTimes(1);
		finish();
		expect(await screen.findByText("Save")).toBeTruthy();
	});
});
