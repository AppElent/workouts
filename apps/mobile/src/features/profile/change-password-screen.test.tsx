import {
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react-native";
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

describe("errors go to the field each Clerk entry names", () => {
	const reject = (...errors: object[]) =>
		mockUser.updatePassword.mockRejectedValueOnce({ errors });
	/** The alert inside the row of the field with this label, if any. */
	const errorOn = (label: string) => {
		const row = screen.getByLabelText(label).parent;
		if (!row) throw new Error(`no row for ${label}`);
		return within(row).queryByRole("alert")?.props.children ?? null;
	};
	const WRONG = "That password is not right.";
	const WEAK = "That password is not strong enough.";

	it("puts a current_password entry on Current password", async () => {
		reject({
			code: "form_password_validation_failed",
			meta: { paramName: "current_password" },
		});
		await renderScreen(<ChangePasswordScreen />);
		await fill("wrong", "a-new-password");
		await screen.findByText(WRONG);
		expect(errorOn("Current password")).toBe(WRONG);
		expect(errorOn("New password")).toBeNull();
	});

	it("puts a password entry on New password", async () => {
		reject({
			code: "form_password_validation_failed",
			meta: { paramName: "password" },
		});
		await renderScreen(<ChangePasswordScreen />);
		await fill("old-password", "weak");
		await screen.findByText(WEAK);
		expect(errorOn("New password")).toBe(WEAK);
		expect(errorOn("Current password")).toBeNull();
	});

	it("shows each entry on its own field when Clerk reports both", async () => {
		// Same code twice: only each entry's paramName tells the fields apart.
		reject(
			{
				code: "form_password_validation_failed",
				meta: { paramName: "new_password" },
			},
			{
				code: "form_password_validation_failed",
				meta: { paramName: "current_password" },
			},
		);
		await renderScreen(<ChangePasswordScreen />);
		await fill("wrong", "weak");
		await screen.findByText(WRONG);
		expect(errorOn("Current password")).toBe(WRONG);
		expect(errorOn("New password")).toBe(WEAK);
	});

	it("shows an error about no field as a toast and stays", async () => {
		reject({ code: "too_many_requests" });
		await renderScreen(<ChangePasswordScreen />);
		await fill("old-password", "a-new-password");
		expect(
			await screen.findByText("Too many attempts. Try again in a moment."),
		).toBeTruthy();
		expect(errorOn("Current password")).toBeNull();
		expect(errorOn("New password")).toBeNull();
		expect(mockBack).not.toHaveBeenCalled();
	});
});

it("does not go back for a change that finishes after leaving the screen", async () => {
	let release: () => void = () => {};
	mockUser.updatePassword.mockReturnValueOnce(
		new Promise<void>((resolve) => {
			release = resolve;
		}),
	);
	const view = await renderScreen(<ChangePasswordScreen />);
	await fireEvent.changeText(
		screen.getByLabelText("Current password"),
		"old-password",
	);
	await fireEvent.changeText(
		screen.getByLabelText("New password"),
		"a-new-password",
	);
	// The handler stays pending until Clerk answers, so the press is awaited last.
	const pressing = fireEvent.press(submit());
	await waitFor(() => expect(mockUser.updatePassword).toHaveBeenCalled());
	await view.unmount();
	release();
	await pressing;
	expect(mockBack).not.toHaveBeenCalled();
});
