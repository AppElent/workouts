import { act, screen } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { Alert, Pressable, Text } from "react-native";
import { LocaleProvider } from "../i18n";
import { pressPending } from "../test-support/press-pending";
import { renderThemed } from "../test-support/render-themed";
import { ConfirmProvider, useConfirm } from "./confirm-dialog";

/** These primitives read their fallback labels from the message catalog. */
const render = async (ui: ReactElement) =>
	await renderThemed(ui, { wrapper: LocaleProvider });

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
	await render(
		<ConfirmProvider>
			<Prompt answered={answered} />
		</ConfirmProvider>,
	);
	const { settled: asking } = await pressPending(screen.getByText("Ask"));
	expect(answered).not.toHaveBeenCalled();
	const buttons = alert.mock.calls[0][2];
	if (!buttons) throw new Error("Native alert did not receive any actions");
	expect(buttons.map(({ text, style }) => ({ text, style }))).toEqual([
		{ text: "Keep set", style: "cancel" },
		{ text: "Delete set", style: "destructive" },
	]);
	await act(async () => buttons[0].onPress?.());
	await asking;
	expect(answered).toHaveBeenLastCalledWith(false);
	const { settled: askingAgain } = await pressPending(screen.getByText("Ask"));
	await act(async () => alert.mock.calls[1][2]?.[1].onPress?.());
	await askingAgain;
	expect(answered).toHaveBeenLastCalledWith(true);
});

it("does not let a dismissed alert answer a newer confirmation", async () => {
	const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
	const answered = jest.fn();
	await render(
		<ConfirmProvider>
			<Prompt answered={answered} />
		</ConfirmProvider>,
	);
	const { settled: asking } = await pressPending(screen.getByText("Ask"));
	const first = alert.mock.calls[0];
	await act(async () => first[2]?.[0].onPress?.());
	await asking;
	const { settled: askingAgain } = await pressPending(screen.getByText("Ask"));
	await act(async () => first[3]?.onDismiss?.());
	expect(answered).toHaveBeenCalledTimes(1);
	await act(async () => alert.mock.calls[1][2]?.[1].onPress?.());
	await askingAgain;
	expect(answered).toHaveBeenLastCalledWith(true);
});

it("settles pending callers when the signed-in shell unmounts", async () => {
	jest.spyOn(Alert, "alert").mockImplementation(() => {});
	const answered = jest.fn();
	const app = await render(
		<ConfirmProvider>
			<Prompt answered={answered} />
		</ConfirmProvider>,
	);
	const { settled: asking } = await pressPending(screen.getByText("Ask"));
	await app.unmount();
	await asking;
	expect(answered).toHaveBeenCalledWith(false);
});
