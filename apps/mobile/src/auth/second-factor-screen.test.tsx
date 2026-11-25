import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import {
	PREFERENCE_KEYS,
	removeLocal,
	writeLocal,
} from "../local-store/local-store";
import { renderScreen } from "../test-support/render-screen";
import { SecondFactorScreen } from "./second-factor-screen";

const ok = { error: null };
const mockSetParams = jest.fn();
const mockDismissTo = jest.fn();
jest.mock("expo-router", () => ({
	useRouter: () => ({
		push: jest.fn(),
		setParams: mockSetParams,
		dismissTo: mockDismissTo,
	}),
	usePreventRemove: jest.fn(),
}));

const mockMfa = {
	verifyTOTP: jest.fn(),
	verifyBackupCode: jest.fn(),
	verifyPhoneCode: jest.fn(),
	verifyEmailCode: jest.fn(),
	sendPhoneCode: jest.fn(),
	sendEmailCode: jest.fn(),
};
const mockSignIn = {
	status: "needs_second_factor",
	supportedSecondFactors: [] as { strategy: string; safeIdentifier?: string }[],
	mfa: mockMfa,
	finalize: jest.fn(),
	reset: jest.fn(),
};
jest.mock("@clerk/expo", () => ({
	useAuth: () => ({ isSignedIn: false }),
	useSignIn: () => ({
		signIn: mockSignIn,
		errors: { fields: {}, global: null },
	}),
}));

const TOTP = { strategy: "totp" };
const BACKUP = { strategy: "backup_code" };
const PHONE = { strategy: "phone_code", safeIdentifier: "+1******0100" };

beforeEach(() => {
	jest.clearAllMocks();
	mockSignIn.supportedSecondFactors = [TOTP, BACKUP];
	for (const fn of Object.values(mockMfa)) fn.mockResolvedValue(ok);
	mockSignIn.finalize.mockResolvedValue(ok);
	mockSignIn.reset.mockResolvedValue(undefined);
});
afterEach(() => removeLocal(PREFERENCE_KEYS.locale));

it("asks for the authenticator code and signs in with it", async () => {
	await renderScreen(<SecondFactorScreen />);
	expect(screen.getByText("Verify it's you")).toBeTruthy();
	expect(
		screen.getByText("Enter the 6-digit code from your authenticator app."),
	).toBeTruthy();
	const field = screen.getByLabelText("Code");
	expect(field.props.textContentType).toBe("oneTimeCode");
	expect(field.props.keyboardType).toBe("number-pad");
	expect(screen.getByTestId("second-factor-submit")).toBeDisabled();

	await fireEvent.changeText(field, "123456");
	await fireEvent.press(screen.getByTestId("second-factor-submit"));
	await waitFor(() => expect(mockSignIn.finalize).toHaveBeenCalled());
	expect(mockMfa.verifyTOTP).toHaveBeenCalledWith({ code: "123456" });
	// No resend for a code nobody sent.
	expect(screen.queryByRole("link", { name: "Send a new code" })).toBeNull();
});

it("shows a wrong code and keeps the field", async () => {
	mockMfa.verifyTOTP.mockResolvedValue({
		error: { code: "form_code_incorrect" },
	});
	await renderScreen(<SecondFactorScreen />);
	await fireEvent.changeText(screen.getByLabelText("Code"), "000000");
	await fireEvent(screen.getByLabelText("Code"), "submitEditing");
	expect(await screen.findByText("That code is not right.")).toBeTruthy();
	expect(screen.getByLabelText("Code")).toBeTruthy();
	expect(mockSignIn.finalize).not.toHaveBeenCalled();
});

it("switches to a backup code with a free-text field", async () => {
	await renderScreen(<SecondFactorScreen />);
	await fireEvent.press(
		screen.getByRole("link", { name: "Use a backup code" }),
	);
	expect(
		screen.getByText("Enter one of the backup codes you saved."),
	).toBeTruthy();
	const field = screen.getByLabelText("Backup code");
	expect(field.props.keyboardType).toBe("default");
	expect(field.props.maxLength).toBeUndefined();
	await fireEvent.changeText(field, "abcd1234");
	await fireEvent.press(screen.getByTestId("second-factor-submit"));
	await waitFor(() =>
		expect(mockMfa.verifyBackupCode).toHaveBeenCalledWith({
			code: "abcd1234",
		}),
	);
	expect(
		screen.getByRole("link", { name: "Use your authenticator app" }),
	).toBeTruthy();
});

it("sends a texted code once and says where it went", async () => {
	mockSignIn.supportedSecondFactors = [PHONE, BACKUP];
	await renderScreen(<SecondFactorScreen />);
	expect(
		screen.getByText("We texted a 6-digit code to +1******0100."),
	).toBeTruthy();
	expect(mockMfa.sendPhoneCode).toHaveBeenCalledTimes(1);
	expect(mockSetParams).toHaveBeenCalledWith({ sent: "1" });

	await fireEvent.press(screen.getByRole("link", { name: "Send a new code" }));
	expect(await screen.findByText("A new code is on its way.")).toBeTruthy();
	expect(mockMfa.sendPhoneCode).toHaveBeenCalledTimes(2);
});

it("does not re-send after a remount", async () => {
	mockSignIn.supportedSecondFactors = [PHONE];
	await renderScreen(<SecondFactorScreen sent />);
	expect(mockMfa.sendPhoneCode).not.toHaveBeenCalled();
});

it("locks the authenticator app after too many wrong codes and finishes with a backup code", async () => {
	mockMfa.verifyTOTP.mockResolvedValue({
		error: { code: "verification_failed" },
	});
	await renderScreen(<SecondFactorScreen />);
	await fireEvent.changeText(screen.getByLabelText("Code"), "000000");
	await fireEvent.press(screen.getByTestId("second-factor-submit"));
	expect(
		await screen.findByText(/Too many wrong codes for this method/),
	).toBeTruthy();
	expect(screen.queryByLabelText("Code")).toBeNull();
	expect(screen.queryByTestId("second-factor-submit")).toBeNull();
	expect(
		screen.queryByText("Enter the 6-digit code from your authenticator app."),
	).toBeNull();

	await fireEvent.press(
		screen.getByRole("link", { name: "Use a backup code" }),
	);
	await fireEvent.changeText(screen.getByLabelText("Backup code"), "abcd1234");
	await fireEvent.press(screen.getByTestId("second-factor-submit"));
	await waitFor(() => expect(mockSignIn.finalize).toHaveBeenCalled());
	expect(mockSignIn.reset).not.toHaveBeenCalled();
});

it("says only the way back is left when the locked method is the only one", async () => {
	mockSignIn.supportedSecondFactors = [TOTP];
	mockMfa.verifyTOTP.mockResolvedValue({
		error: { code: "verification_failed" },
	});
	await renderScreen(<SecondFactorScreen />);
	await fireEvent.changeText(screen.getByLabelText("Code"), "000000");
	await fireEvent.press(screen.getByTestId("second-factor-submit"));
	expect(
		await screen.findByText("Too many wrong codes. Go back and sign in again."),
	).toBeTruthy();
	expect(screen.getByRole("link", { name: "Back to sign in" })).toBeTruthy();
});

it("sends a new texted code after too many wrong ones and signs in with it", async () => {
	mockSignIn.supportedSecondFactors = [PHONE, BACKUP];
	mockMfa.verifyPhoneCode.mockResolvedValueOnce({
		error: { code: "verification_failed" },
	});
	await renderScreen(<SecondFactorScreen sent />);
	await fireEvent.changeText(screen.getByLabelText("Code"), "000000");
	await fireEvent.press(screen.getByTestId("second-factor-submit"));
	expect(
		await screen.findByText("Too many wrong codes. Send a new one."),
	).toBeTruthy();
	expect(screen.queryByLabelText("Code")).toBeNull();
	expect(screen.getByRole("link", { name: "Use a backup code" })).toBeTruthy();

	await fireEvent.press(screen.getByRole("link", { name: "Send a new code" }));
	expect(await screen.findByText("A new code is on its way.")).toBeTruthy();
	const field = screen.getByLabelText("Code");
	expect(field.props.value).toBe("");
	await fireEvent.changeText(field, "424242");
	await fireEvent.press(screen.getByTestId("second-factor-submit"));
	await waitFor(() => expect(mockSignIn.finalize).toHaveBeenCalled());
	expect(mockMfa.verifyPhoneCode).toHaveBeenLastCalledWith({ code: "424242" });
});

it("does not offer a locked method as another one", async () => {
	mockMfa.verifyTOTP.mockResolvedValue({
		error: { code: "verification_failed" },
	});
	mockMfa.verifyBackupCode.mockResolvedValue({
		error: { code: "verification_failed" },
	});
	await renderScreen(<SecondFactorScreen />);
	await fireEvent.changeText(screen.getByLabelText("Code"), "000000");
	await fireEvent.press(screen.getByTestId("second-factor-submit"));
	await screen.findByText(/Too many wrong codes for this method/);
	await fireEvent.press(
		screen.getByRole("link", { name: "Use a backup code" }),
	);
	await fireEvent.changeText(screen.getByLabelText("Backup code"), "abcd1234");
	await fireEvent.press(screen.getByTestId("second-factor-submit"));
	expect(
		await screen.findByText("Too many wrong codes. Go back and sign in again."),
	).toBeTruthy();
});

it("ends an expired attempt with only a way back", async () => {
	mockMfa.verifyTOTP.mockResolvedValue({
		error: { code: "sign_in_expired" },
	});
	await renderScreen(<SecondFactorScreen />);
	await fireEvent.changeText(screen.getByLabelText("Code"), "000000");
	await fireEvent.press(screen.getByTestId("second-factor-submit"));
	expect(await screen.findByText(/took too long/)).toBeTruthy();
	expect(screen.queryByLabelText("Code")).toBeNull();
	expect(screen.queryByTestId("second-factor-submit")).toBeNull();
	expect(screen.queryByRole("link", { name: "Use a backup code" })).toBeNull();

	await fireEvent.press(screen.getByRole("link", { name: "Back to sign in" }));
	await waitFor(() => expect(mockDismissTo).toHaveBeenCalledWith("/sign-in"));
	expect(mockSignIn.reset).toHaveBeenCalled();
});

it("drops the attempt before going back to sign in", async () => {
	await renderScreen(<SecondFactorScreen />);
	await fireEvent.press(screen.getByRole("link", { name: "Back to sign in" }));
	await waitFor(() => expect(mockDismissTo).toHaveBeenCalledWith("/sign-in"));
	expect(mockSignIn.reset).toHaveBeenCalled();
});

it("says the password changed when a reset led here", async () => {
	await renderScreen(<SecondFactorScreen from="reset" />);
	expect(
		screen.getByText("Your password is changed. One more step to sign in."),
	).toBeTruthy();
});

it("offers only the way back when no method works in this app", async () => {
	mockSignIn.supportedSecondFactors = [{ strategy: "passkey" }];
	await renderScreen(<SecondFactorScreen />);
	expect(screen.getByText(/isn't available in this app/)).toBeTruthy();
	expect(screen.queryByLabelText("Code")).toBeNull();
	expect(screen.getByRole("link", { name: "Back to sign in" })).toBeTruthy();
});

it("speaks Dutch", async () => {
	writeLocal(PREFERENCE_KEYS.locale, "nl");
	mockSignIn.supportedSecondFactors = [PHONE, TOTP, BACKUP];
	await renderScreen(<SecondFactorScreen sent />);
	expect(screen.getByText("Bevestig dat jij het bent")).toBeTruthy();
	expect(
		screen.getByText("Vul de code van 6 cijfers uit je authenticator-app in."),
	).toBeTruthy();
	expect(
		screen.getByRole("link", { name: "Sms een code naar +1******0100" }),
	).toBeTruthy();
	expect(
		screen.getByRole("link", { name: "Back-upcode gebruiken" }),
	).toBeTruthy();
	expect(
		screen.getByRole("link", { name: "Terug naar inloggen" }),
	).toBeTruthy();
});
