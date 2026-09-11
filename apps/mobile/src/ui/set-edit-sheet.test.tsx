import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, Modal } from "react-native";
import type { Doc, Id } from "../convex/api";
import { ConfirmProvider } from "./confirm-dialog";
import { SetEditSheet } from "./set-edit-sheet";

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));
jest.mock("./toast", () => ({ useToast: () => ({ error: jest.fn() }) }));

const loggedSet: Doc<"sets"> = {
	_id: "set-1" as Id<"sets">,
	_creationTime: 0,
	sessionId: "session-1" as Id<"workoutSessions">,
	exerciseId: "exercise-1" as Id<"exercises">,
	userId: "user-1",
	setNumber: 1,
	weight: 30,
	reps: 8,
	unit: "kg",
	setType: "working",
	loggedAt: 0,
};

afterEach(() => jest.restoreAllMocks());

it("allows native dismissal of a clean sheet but protects unsaved edits", async () => {
	const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
	const onClose = jest.fn();
	const app = render(
		<ConfirmProvider>
			<SetEditSheet
				set={loggedSet}
				weightStep={2.5}
				exerciseName="Squat"
				onClose={onClose}
			/>
		</ConfirmProvider>,
	);
	const nativeSheet = () =>
		app
			.UNSAFE_getAllByType(Modal)
			.find((modal) => modal.props.presentationStyle === "pageSheet");
	expect(nativeSheet()?.props.allowSwipeDismissal).toBe(true);
	fireEvent.press(screen.getByLabelText("Increase kg"));
	expect(screen.getByText("32.5")).toBeTruthy();
	expect(nativeSheet()?.props.allowSwipeDismissal).toBe(false);
	fireEvent.press(screen.getByLabelText("Close"));
	expect(alert).toHaveBeenCalledWith(
		"Discard changes?",
		expect.any(String),
		expect.any(Array),
		expect.any(Object),
	);
	await act(async () => alert.mock.calls[0][2]?.[0].onPress?.());
	expect(onClose).not.toHaveBeenCalled();
	expect(screen.getByText("32.5")).toBeTruthy();
	fireEvent.press(screen.getByLabelText("Close"));
	await act(async () => alert.mock.calls[1][2]?.[1].onPress?.());
	expect(onClose).toHaveBeenCalledTimes(1);
});
