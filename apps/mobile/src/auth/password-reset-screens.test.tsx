import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderScreen } from "../test-support/render-screen";
import { ForgotPasswordScreen } from "./forgot-password-screen";
import { ResetPasswordScreen } from "./reset-password-screen";
import { SignInScreen } from "./sign-in-screen";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockDismissTo = jest.fn();
jest.mock("expo-router", () => ({
	useRouter: () => ({
		push: mockPush,
		back: mockBack,
		replace: jest.fn(),
		dismissTo: mockDismissTo,
	}),
}));

const ok = { error: null };
const mockSignIn = {
	status: "needs_first_factor",
	create: jest.fn(),
	password: jest.fn(),
	emailCode: { sendCode: jest.fn() },
	resetPasswordEmailCode: {
		sendCode: jest.fn(),
		verifyCode: jest.fn(),
		submitPassword: jest.fn(),
	},
	finalize: jest.fn(),
	reset: jest.fn(),
};
jest.mock("@clerk/expo", () => ({
	useSignIn: () => ({
		signIn: mockSignIn,
		errors: { fields: {}, global: null },
	}),
}));
jest.mock("./config", () => ({ devLogin: null }));
jest.mock("./social-buttons", () => ({ SocialButtons: () => null }));

beforeEach(() => {
	jest.clearAllMocks();
	mockSignIn.status = "needs_first_factor";
});

it("links from sign-in to the reset with the typed email", async () => {
	await renderScreen(<SignInScreen />);
	await fireEvent.changeText(
		screen.getByLabelText("Email"),
		" sam@example.test ",
	);
	await fireEvent.press(screen.getByRole("link", { name: "Forgot password?" }));
	expect(mockPush).toHaveBeenCalledWith({
		pathname: "/forgot-password",
		params: { email: "sam@example.test" },
	});
});

it("sends the reset code and moves on to the code screen", async () => {
	mockSignIn.create.mockResolvedValue(ok);
	mockSignIn.resetPasswordEmailCode.sendCode.mockResolvedValue(ok);
	await renderScreen(<ForgotPasswordScreen email="sam@example.test" />);
	expect(screen.getByLabelText("Email").props.value).toBe("sam@example.test");
	await fireEvent.press(screen.getByRole("button", { name: "Send code" }));
	await waitFor(() =>
		expect(mockPush).toHaveBeenCalledWith({
			pathname: "/reset-password",
			params: { email: "sam@example.test" },
		}),
	);
	expect(mockSignIn.create).toHaveBeenCalledWith({
		identifier: "sam@example.test",
	});
});

it("keeps an unknown email on the request screen with a clear error", async () => {
	mockSignIn.create.mockResolvedValue({
		error: { code: "form_identifier_not_found" },
	});
	await renderScreen(<ForgotPasswordScreen email="" />);
	expect(
		screen.getByRole("button", { name: "Send code" }).props.accessibilityState
			.disabled,
	).toBe(true);
	await fireEvent.changeText(screen.getByLabelText("Email"), "nobody@x.test");
	await fireEvent.press(screen.getByRole("button", { name: "Send code" }));
	expect(
		await screen.findByText("No account found with that email."),
	).toBeTruthy();
	expect(mockPush).not.toHaveBeenCalled();
});

it("resets with the code and a new password, then signs in", async () => {
	mockSignIn.resetPasswordEmailCode.verifyCode.mockImplementation(async () => {
		mockSignIn.status = "needs_new_password";
		return ok;
	});
	mockSignIn.resetPasswordEmailCode.submitPassword.mockImplementation(
		async () => {
			mockSignIn.status = "complete";
			return ok;
		},
	);
	mockSignIn.finalize.mockResolvedValue(ok);
	await renderScreen(<ResetPasswordScreen email="sam@example.test" />);
	expect(screen.getByText(/sent to sam@example\.test/)).toBeTruthy();
	const submit = () => screen.getByRole("button", { name: "Reset password" });
	expect(submit().props.accessibilityState.disabled).toBe(true);

	await fireEvent.changeText(screen.getByLabelText("Code"), "424242");
	const password = screen.getByLabelText("New password");
	expect(password.props.secureTextEntry).toBe(true);
	expect(password.props.textContentType).toBe("newPassword");
	await fireEvent.changeText(password, "a-new-password");
	await fireEvent.press(submit());

	await waitFor(() => expect(mockSignIn.finalize).toHaveBeenCalled());
	expect(mockSignIn.resetPasswordEmailCode.submitPassword).toHaveBeenCalledWith(
		{ password: "a-new-password", signOutOfOtherSessions: true },
	);
});

it("shows a wrong code on the code screen", async () => {
	mockSignIn.resetPasswordEmailCode.verifyCode.mockResolvedValue({
		error: { code: "form_code_incorrect" },
	});
	await renderScreen(<ResetPasswordScreen email="sam@example.test" />);
	await fireEvent.changeText(screen.getByLabelText("Code"), "000000");
	await fireEvent.changeText(
		screen.getByLabelText("New password"),
		"pw-123456",
	);
	await fireEvent.press(screen.getByRole("button", { name: "Reset password" }));
	expect(await screen.findByText("That code is not right.")).toBeTruthy();
	expect(mockSignIn.finalize).not.toHaveBeenCalled();
});

it("starts over from the code screen with a different email", async () => {
	mockSignIn.reset.mockResolvedValue(ok);
	await renderScreen(<ResetPasswordScreen email="sam@example.test" />);
	await fireEvent.press(
		screen.getByRole("link", { name: "Use a different email" }),
	);
	await waitFor(() => expect(mockBack).toHaveBeenCalled());
	expect(mockSignIn.reset).toHaveBeenCalled();
});

it("keeps resend and a different email closed while a reset runs", async () => {
	let release: (value: typeof ok) => void = () => {};
	mockSignIn.resetPasswordEmailCode.verifyCode.mockReturnValue(
		new Promise((resolve) => {
			release = resolve;
		}),
	);
	mockSignIn.resetPasswordEmailCode.submitPassword.mockResolvedValue({
		error: { code: "form_password_pwned" },
	});
	await renderScreen(<ResetPasswordScreen email="sam@example.test" />);
	await fireEvent.changeText(screen.getByLabelText("Code"), "424242");
	await fireEvent.changeText(
		screen.getByLabelText("New password"),
		"a-new-password",
	);
	await fireEvent.press(screen.getByRole("button", { name: "Reset password" }));
	const resend = screen.getByRole("link", { name: "Send a new code" });
	const changeEmail = screen.getByRole("link", {
		name: "Use a different email",
	});
	expect(resend.props.accessibilityState.disabled).toBe(true);
	expect(changeEmail.props.accessibilityState.disabled).toBe(true);
	await fireEvent.press(changeEmail);
	expect(mockSignIn.reset).not.toHaveBeenCalled();
	expect(mockBack).not.toHaveBeenCalled();
	await act(async () => release(ok));
	expect(await screen.findByText(/appeared in a data breach/)).toBeTruthy();
});

it("does not open the code screen after leaving a pending request", async () => {
	let release: (value: typeof ok) => void = () => {};
	mockSignIn.create.mockReturnValue(
		new Promise((resolve) => {
			release = resolve;
		}),
	);
	mockSignIn.resetPasswordEmailCode.sendCode.mockResolvedValue(ok);
	const view = await renderScreen(
		<ForgotPasswordScreen email="sam@example.test" />,
	);
	// The handler stays pending until Clerk answers, so the press is awaited last.
	const pressing = fireEvent.press(
		screen.getByRole("button", { name: "Send code" }),
	);
	await waitFor(() =>
		expect(
			screen.getByRole("link", { name: "Back to sign in" }).props
				.accessibilityState.disabled,
		).toBe(true),
	);
	// The swipe-back gesture still leaves the screen.
	await view.unmount();
	release(ok);
	await pressing;
	expect(mockSignIn.resetPasswordEmailCode.sendCode).toHaveBeenCalled();
	expect(mockPush).not.toHaveBeenCalled();
});

it("disables the reset when iOS clears the new password without a change event", async () => {
	await renderScreen(<ResetPasswordScreen email="sam@example.test" />);
	await fireEvent.changeText(screen.getByLabelText("Code"), "424242");
	const password = screen.getByLabelText("New password");
	await fireEvent.changeText(password, "a-new-password");
	const submit = () => screen.getByRole("button", { name: "Reset password" });
	expect(submit().props.accessibilityState.disabled).toBe(false);
	await fireEvent(password, "endEditing", { nativeEvent: { text: "" } });
	expect(submit().props.accessibilityState.disabled).toBe(true);
});

async function enterCodeAndPassword() {
	await fireEvent.changeText(screen.getByLabelText("Code"), "424242");
	await fireEvent.changeText(
		screen.getByLabelText("New password"),
		"a-new-password",
	);
	await fireEvent.press(screen.getByRole("button", { name: "Reset password" }));
}

it("after a saved password, only signs in again when that fails", async () => {
	mockSignIn.resetPasswordEmailCode.verifyCode.mockImplementation(async () => {
		mockSignIn.status = "needs_new_password";
		return ok;
	});
	mockSignIn.resetPasswordEmailCode.submitPassword.mockImplementation(
		async () => {
			mockSignIn.status = "complete";
			return ok;
		},
	);
	mockSignIn.finalize
		.mockResolvedValueOnce({ error: { code: "network_error" } })
		.mockResolvedValueOnce(ok);
	await renderScreen(<ResetPasswordScreen email="sam@example.test" />);
	await enterCodeAndPassword();

	expect(await screen.findByText("Your password is changed.")).toBeTruthy();
	expect(screen.getByText(/Network error/)).toBeTruthy();
	expect(screen.getByLabelText("New password").props.editable).toBe(false);
	expect(screen.getByLabelText("Code").props.editable).toBe(false);
	expect(screen.queryByRole("link", { name: "Send a new code" })).toBeNull();
	expect(screen.queryByRole("button", { name: "Reset password" })).toBeNull();

	await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
	await waitFor(() => expect(mockSignIn.finalize).toHaveBeenCalledTimes(2));
	expect(
		mockSignIn.resetPasswordEmailCode.submitPassword,
	).toHaveBeenCalledTimes(1);
});

it("ends a reset that needs a second factor with a way back to sign in", async () => {
	mockSignIn.resetPasswordEmailCode.verifyCode.mockResolvedValue(ok);
	mockSignIn.resetPasswordEmailCode.submitPassword.mockImplementation(
		async () => {
			mockSignIn.status = "needs_second_factor";
			return ok;
		},
	);
	const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
	await renderScreen(<ResetPasswordScreen email="sam@example.test" />);
	await enterCodeAndPassword();

	expect(
		await screen.findByText(/sign in with the new password in the web app/),
	).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Reset password" })).toBeNull();
	await fireEvent.press(screen.getByRole("link", { name: "Back to sign in" }));
	expect(mockDismissTo).toHaveBeenCalledWith("/sign-in");
	expect(mockSignIn.finalize).not.toHaveBeenCalled();
	warn.mockRestore();
});

it("shows a resend that throws and lets it be retried", async () => {
	mockSignIn.resetPasswordEmailCode.sendCode
		.mockRejectedValueOnce(new Error("offline"))
		.mockResolvedValueOnce(ok);
	await renderScreen(<ResetPasswordScreen email="sam@example.test" />);
	await fireEvent.press(screen.getByRole("link", { name: "Send a new code" }));
	expect(await screen.findByText(/Network error/)).toBeTruthy();
	await fireEvent.press(screen.getByRole("link", { name: "Send a new code" }));
	expect(await screen.findByText("A new code is on its way.")).toBeTruthy();
	expect(screen.queryByText(/Network error/)).toBeNull();
});

it("does not go back for a start-over that finishes after leaving", async () => {
	let release: (value: typeof ok) => void = () => {};
	mockSignIn.reset.mockReturnValue(
		new Promise((resolve) => {
			release = resolve;
		}),
	);
	const view = await renderScreen(
		<ResetPasswordScreen email="sam@example.test" />,
	);
	// The handler stays pending until Clerk answers, so the press is awaited last.
	const pressing = fireEvent.press(
		screen.getByRole("link", { name: "Use a different email" }),
	);
	await waitFor(() => expect(mockSignIn.reset).toHaveBeenCalled());
	await view.unmount();
	release(ok);
	await pressing;
	expect(mockBack).not.toHaveBeenCalled();
});

it("submits the password the keyboard's Go reports", async () => {
	mockSignIn.resetPasswordEmailCode.verifyCode.mockResolvedValue(ok);
	mockSignIn.resetPasswordEmailCode.submitPassword.mockResolvedValue({
		error: { code: "form_password_pwned" },
	});
	await renderScreen(<ResetPasswordScreen email="sam@example.test" />);
	await fireEvent.changeText(screen.getByLabelText("Code"), "424242");
	// AutoFill filled the field natively; no change event reached React yet.
	await fireEvent(screen.getByLabelText("New password"), "submitEditing", {
		nativeEvent: { text: "an-autofilled-password" },
	});
	await waitFor(() =>
		expect(
			mockSignIn.resetPasswordEmailCode.submitPassword,
		).toHaveBeenCalledWith({
			password: "an-autofilled-password",
			signOutOfOtherSessions: true,
		}),
	);
});
