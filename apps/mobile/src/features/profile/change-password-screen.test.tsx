import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderScreen } from "../../test-support/render-screen";
import { ChangePasswordScreen } from "./change-password-screen";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack }) }));

const mockUser = {
	passwordEnabled: true,
	primaryEmailAddress: { emailAddress: "alex@example.test" },
	updatePassword: jest.fn(),
};
jest.mock("@clerk/expo", () => ({ useUser: () => ({ user: mockUser }) }));

beforeEach(() => {
	jest.clearAllMocks();
	mockUser.passwordEnabled = true;
	mockUser.updatePassword.mockResolvedValue(undefined);
});

const submit = () => screen.getByRole("button", { name: "Change password" });

async function fill(current: string, next: string) {
	await fireEvent.changeText(
		screen.getByLabelText("Current password"),
		current,
	);
	await fireEvent.changeText(screen.getByLabelText("New password"), next);
	await fireEvent.press(submit());
}

it("lays the fields out the way iOS AutoFill expects", async () => {
	await renderScreen(<ChangePasswordScreen />);
	const username = screen.getByLabelText("Email");
	expect(username.props.value).toBe("alex@example.test");
	expect(username.props.editable).toBe(false);
	expect(username.props.textContentType).toBe("username");
	expect(username.props.autoComplete).toBe("username");
	const current = screen.getByLabelText("Current password");
	expect(current.props.textContentType).toBe("password");
	expect(current.props.secureTextEntry).toBe(true);
	const next = screen.getByLabelText("New password");
	expect(next.props.textContentType).toBe("newPassword");
	expect(next.props.secureTextEntry).toBe(true);
	expect(submit().props.accessibilityState.disabled).toBe(true);
});

it("changes the password, signs out other sessions, and goes back", async () => {
	await renderScreen(<ChangePasswordScreen />);
	await fill("old-password", "a-new-password");
	await waitFor(() => expect(mockBack).toHaveBeenCalled());
	expect(mockUser.updatePassword).toHaveBeenCalledWith({
		currentPassword: "old-password",
		newPassword: "a-new-password",
		signOutOfOtherSessions: true,
	});
	expect(screen.getByText("Password changed.")).toBeTruthy();
});

it("disables the action again when iOS clears a field without a change event", async () => {
	await renderScreen(<ChangePasswordScreen />);
	const current = screen.getByLabelText("Current password");
	await fireEvent.changeText(current, "old-password");
	await fireEvent.changeText(
		screen.getByLabelText("New password"),
		"a-new-password",
	);
	expect(submit().props.accessibilityState.disabled).toBe(false);
	// Declining "Use Strong Password?" blanks the field natively; only
	// onEndEditing reports it.
	await fireEvent(current, "endEditing", { nativeEvent: { text: "" } });
	expect(submit().props.accessibilityState.disabled).toBe(true);
});

it("shows a wrong current password on that field and stays", async () => {
	// Clerk's real response for a wrong current password (dev instance).
	mockUser.updatePassword.mockRejectedValueOnce({
		errors: [
			{
				code: "form_password_validation_failed",
				meta: { paramName: "current_password" },
			},
		],
	});
	await renderScreen(<ChangePasswordScreen />);
	await fill("wrong", "a-new-password");
	expect(await screen.findByText("That password is not right.")).toBeTruthy();
	expect(screen.getByLabelText("New password").props.value).toBe(
		"a-new-password",
	);
	expect(mockBack).not.toHaveBeenCalled();
});

it("explains a weak new password", async () => {
	mockUser.updatePassword.mockRejectedValueOnce({
		errors: [
			{
				code: "form_password_validation_failed",
				meta: { paramName: "new_password" },
			},
		],
	});
	await renderScreen(<ChangePasswordScreen />);
	await fill("old-password", "weak");
	expect(
		await screen.findByText("That password is not strong enough."),
	).toBeTruthy();
});

it("explains a breached new password", async () => {
	mockUser.updatePassword.mockRejectedValueOnce({
		errors: [
			{ code: "form_password_pwned", meta: { paramName: "new_password" } },
		],
	});
	await renderScreen(<ChangePasswordScreen />);
	await fill("old-password", "password");
	expect(await screen.findByText(/appeared in a data breach/)).toBeTruthy();
});

it("renders nothing for an account without a password", async () => {
	mockUser.passwordEnabled = false;
	await renderScreen(<ChangePasswordScreen />);
	expect(screen.queryByLabelText("Current password")).toBeNull();
});
