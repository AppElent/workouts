import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, Pressable, Text } from "react-native";
import { ConfirmProvider, useConfirm } from "./confirm-dialog";

function Prompt({ answered }: { answered: (value: boolean) => void }) {
	const confirm = useConfirm();
	return (
		<Pressable
			onPress={async () =>
				answered(
					await confirm({
						title: "Delete this set?",
						confirmLabel: "Delete set",
						cancelLabel: "Keep set",
						destructive: true,
					}),
				)
			}
		>
			<Text>Ask</Text>
		</Pressable>
	);
}

afterEach(() => jest.restoreAllMocks());

it("uses native cancel/destructive actions and waits for the user's answer", async () => {
	const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
	const answered = jest.fn();
	render(
		<ConfirmProvider>
			<Prompt answered={answered} />
		</ConfirmProvider>,
	);
	fireEvent.press(screen.getByText("Ask"));
	expect(answered).not.toHaveBeenCalled();
	const buttons = alert.mock.calls[0][2];
	if (!buttons) throw new Error("Native alert did not receive any actions");
	expect(buttons.map(({ text, style }) => ({ text, style }))).toEqual([
		{ text: "Keep set", style: "cancel" },
		{ text: "Delete set", style: "destructive" },
	]);
	await act(async () => buttons[0].onPress?.());
	expect(answered).toHaveBeenLastCalledWith(false);
	fireEvent.press(screen.getByText("Ask"));
	await act(async () => alert.mock.calls[1][2]?.[1].onPress?.());
	expect(answered).toHaveBeenLastCalledWith(true);
});

it("does not let a dismissed alert answer a newer confirmation", async () => {
	const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
	const answered = jest.fn();
	render(
		<ConfirmProvider>
			<Prompt answered={answered} />
		</ConfirmProvider>,
	);
	fireEvent.press(screen.getByText("Ask"));
	const first = alert.mock.calls[0];
	await act(async () => first[2]?.[0].onPress?.());
	fireEvent.press(screen.getByText("Ask"));
	await act(async () => first[3]?.onDismiss?.());
	expect(answered).toHaveBeenCalledTimes(1);
	await act(async () => alert.mock.calls[1][2]?.[1].onPress?.());
	expect(answered).toHaveBeenLastCalledWith(true);
});

it("settles pending callers when the signed-in shell unmounts", async () => {
	jest.spyOn(Alert, "alert").mockImplementation(() => {});
	const answered = jest.fn();
	const app = render(
		<ConfirmProvider>
			<Prompt answered={answered} />
		</ConfirmProvider>,
	);
	fireEvent.press(screen.getByText("Ask"));
	await act(async () => app.unmount());
	expect(answered).toHaveBeenCalledWith(false);
});
