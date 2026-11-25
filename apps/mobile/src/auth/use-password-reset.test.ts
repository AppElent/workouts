import { act, renderHook } from "@testing-library/react-native";
import { LocaleProvider } from "../i18n";
import {
	PREFERENCE_KEYS,
	removeLocal,
	writeLocal,
} from "../local-store/local-store";
import { usePasswordReset } from "./use-password-reset";

const mockCreate = jest.fn();
const mockSendCode = jest.fn();
const mockVerifyCode = jest.fn();
const mockSubmitPassword = jest.fn();
const mockFinalize = jest.fn();
const mockReset = jest.fn();
const mockErrors = { fields: {}, global: null };
const mockSignIn = {
	status: "needs_identifier" as string,
	create: mockCreate,
	resetPasswordEmailCode: {
		sendCode: mockSendCode,
		verifyCode: mockVerifyCode,
		submitPassword: mockSubmitPassword,
	},
	finalize: mockFinalize,
	reset: mockReset,
};

jest.mock("@clerk/expo", () => ({
	useSignIn: () => ({ signIn: mockSignIn, errors: mockErrors }),
}));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
}));

const ok = { error: null };

beforeEach(() => {
	mockSignIn.status = "needs_first_factor";
	mockVerifyCode.mockImplementation(async () => {
		mockSignIn.status = "needs_new_password";
		return ok;
	});
	mockSubmitPassword.mockImplementation(async () => {
		mockSignIn.status = "complete";
		return ok;
	});
	mockFinalize.mockResolvedValue(ok);
});

afterEach(() => {
	jest.resetAllMocks();
	removeLocal(PREFERENCE_KEYS.locale);
});

const renderReset = () =>
	renderHook(() => usePasswordReset(), { wrapper: LocaleProvider });

it("starts a sign-in for the trimmed address and emails a reset code", async () => {
	mockCreate.mockResolvedValue(ok);
	mockSendCode.mockResolvedValue(ok);
	const { result } = await renderReset();
	let sent = false;
	await act(async () => {
		sent = await result.current.request("  a@b.com ");
	});
	expect(mockCreate).toHaveBeenCalledWith({ identifier: "a@b.com" });
	expect(mockSendCode).toHaveBeenCalled();
	expect(sent).toBe(true);
	expect(result.current.busy).toBe(false);
});

it("explains an unknown email and sends nothing", async () => {
	mockCreate.mockResolvedValue({
		error: { code: "form_identifier_not_found" },
	});
	const { result } = await renderReset();
	let sent = true;
	await act(async () => {
		sent = await result.current.request("nobody@b.com");
	});
	expect(sent).toBe(false);
	expect(mockSendCode).not.toHaveBeenCalled();
	expect(result.current.error).toBe("No account found with that email.");
});

it("verifies the code, saves the password, and signs in", async () => {
	const { result } = await renderReset();
	await act(() => result.current.reset("424242", "a-new-password"));
	expect(mockVerifyCode).toHaveBeenCalledWith({ code: "424242" });
	expect(mockSubmitPassword).toHaveBeenCalledWith({
		password: "a-new-password",
		signOutOfOtherSessions: true,
	});
	expect(mockFinalize).toHaveBeenCalled();
	expect(result.current.error).toBeNull();
});

it("stops at a wrong code without touching the password", async () => {
	mockVerifyCode.mockResolvedValue({ error: { code: "form_code_incorrect" } });
	const { result } = await renderReset();
	await act(() => result.current.reset("000000", "a-new-password"));
	expect(mockSubmitPassword).not.toHaveBeenCalled();
	expect(mockFinalize).not.toHaveBeenCalled();
	expect(result.current.error).toBe("That code is not right.");
	expect(result.current.busy).toBe(false);
});

it("retries a rejected password without re-verifying the used code", async () => {
	mockSubmitPassword.mockResolvedValueOnce({
		error: { code: "form_password_pwned" },
	});
	const { result } = await renderReset();
	await act(() => result.current.reset("424242", "password"));
	expect(result.current.error).toMatch(/data breach/);
	expect(mockFinalize).not.toHaveBeenCalled();

	await act(() => result.current.reset("424242", "a-better-password"));
	expect(mockVerifyCode).toHaveBeenCalledTimes(1);
	expect(mockSubmitPassword).toHaveBeenLastCalledWith({
		password: "a-better-password",
		signOutOfOtherSessions: true,
	});
	expect(mockFinalize).toHaveBeenCalled();
});

it("explains a weak password in Dutch", async () => {
	writeLocal(PREFERENCE_KEYS.locale, "nl");
	mockSubmitPassword.mockResolvedValue({
		error: { code: "form_password_length_too_short" },
	});
	const { result } = await renderReset();
	await act(() => result.current.reset("424242", "short"));
	expect(result.current.error).toBe("Dat wachtwoord is te kort.");
});

it("continues a reset that needs a second factor into that step", async () => {
	mockSubmitPassword.mockImplementation(async () => {
		mockSignIn.status = "needs_second_factor";
		return ok;
	});
	const { result } = await renderReset();
	await act(() => result.current.reset("424242", "a-new-password"));
	expect(mockFinalize).not.toHaveBeenCalled();
	expect(mockPush).toHaveBeenCalledWith({
		pathname: "/sign-in-second-factor",
		params: { from: "reset" },
	});
	expect(result.current.stage).toBe("saved");
	expect(result.current.error).toBeNull();
	expect(result.current.busy).toBe(false);
});

it("verifies a new device (Device Trust) with the same step", async () => {
	mockSubmitPassword.mockImplementation(async () => {
		mockSignIn.status = "needs_client_trust";
		return ok;
	});
	const { result } = await renderReset();
	await act(() => result.current.reset("424242", "a-new-password"));
	expect(mockPush).toHaveBeenCalledTimes(1);
	expect(mockFinalize).not.toHaveBeenCalled();
});

it("does not finalize a reset that needs a step the app cannot do", async () => {
	mockSubmitPassword.mockImplementation(async () => {
		mockSignIn.status = "needs_protect_check";
		return ok;
	});
	const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
	const { result } = await renderReset();
	await act(() => result.current.reset("424242", "a-new-password"));
	expect(mockFinalize).not.toHaveBeenCalled();
	expect(mockPush).not.toHaveBeenCalled();
	expect(result.current.stage).toBe("unsupported");
	expect(result.current.error).toMatch(/doesn't support yet/);
	expect(result.current.busy).toBe(false);
	warn.mockRestore();
});

it("resends to the address already in progress", async () => {
	mockSendCode.mockResolvedValue(ok);
	const { result } = await renderReset();
	let sent = false;
	await act(async () => {
		sent = await result.current.resend();
	});
	expect(sent).toBe(true);
	expect(mockSendCode).toHaveBeenCalledWith();
	expect(mockCreate).not.toHaveBeenCalled();
});

it("starts over so a corrected address gets a fresh reset", async () => {
	mockReset.mockResolvedValue(ok);
	const { result } = await renderReset();
	await act(() => result.current.startOver());
	expect(mockReset).toHaveBeenCalled();
});

it("locks the saved password and retries only the sign-in after finalize fails", async () => {
	mockFinalize.mockResolvedValueOnce({ error: { code: "network_error" } });
	const { result } = await renderReset();
	await act(() => result.current.reset("424242", "a-new-password"));
	expect(result.current.stage).toBe("saved");
	expect(result.current.error).toBe(
		"Network error. Check your connection and try again.",
	);
	expect(result.current.busy).toBe(false);

	// A different password typed now is not sent: Clerk already has one.
	await act(() => result.current.reset("424242", "another-password"));
	expect(mockSubmitPassword).toHaveBeenCalledTimes(1);
	expect(mockFinalize).toHaveBeenCalledTimes(1);

	await act(() => result.current.finish());
	expect(mockVerifyCode).toHaveBeenCalledTimes(1);
	expect(mockFinalize).toHaveBeenCalledTimes(2);
});
it("runs one action on the attempt at a time", async () => {
	let release: (value: typeof ok) => void = () => {};
	mockVerifyCode.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				release = (value) => {
					mockSignIn.status = "needs_new_password";
					resolve(value);
				};
			}),
	);
	const { result } = await renderReset();
	let pending: Promise<void> = Promise.resolve();
	await act(async () => {
		pending = result.current.reset("424242", "a-new-password");
	});
	expect(result.current.locked).toBe(true);

	let resent = true;
	let startedOver = true;
	await act(async () => {
		resent = await result.current.resend();
		startedOver = await result.current.startOver();
	});
	expect(resent).toBe(false);
	expect(startedOver).toBe(false);
	expect(mockSendCode).not.toHaveBeenCalled();
	expect(mockReset).not.toHaveBeenCalled();

	await act(async () => {
		release(ok);
		await pending;
	});
	expect(mockFinalize).toHaveBeenCalled();
});

it("shares the lock with the other reset screen", async () => {
	let release: (value: typeof ok) => void = () => {};
	mockVerifyCode.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				release = (value) => {
					mockSignIn.status = "needs_new_password";
					resolve(value);
				};
			}),
	);
	const codeScreen = await renderReset();
	const requestScreen = await renderReset();
	let pending: Promise<void> = Promise.resolve();
	await act(async () => {
		pending = codeScreen.result.current.reset("424242", "a-new-password");
	});
	let sent = true;
	await act(async () => {
		sent = await requestScreen.result.current.request("other@b.com");
	});
	expect(sent).toBe(false);
	expect(mockCreate).not.toHaveBeenCalled();
	await act(async () => {
		release(ok);
		await pending;
	});
});

it("explains a resend that throws and lets it be retried", async () => {
	mockSendCode.mockRejectedValueOnce(new Error("offline"));
	const { result } = await renderReset();
	let sent = true;
	await act(async () => {
		sent = await result.current.resend();
	});
	expect(sent).toBe(false);
	expect(result.current.error).toBe(
		"Network error. Check your connection and try again.",
	);
	expect(result.current.locked).toBe(false);
	mockSendCode.mockResolvedValue(ok);
	await act(async () => {
		sent = await result.current.resend();
	});
	expect(sent).toBe(true);
	expect(result.current.error).toBeNull();
});

it("explains a start-over that throws and stays", async () => {
	mockReset.mockRejectedValueOnce(new Error("offline"));
	const { result } = await renderReset();
	let left = true;
	await act(async () => {
		left = await result.current.startOver();
	});
	expect(left).toBe(false);
	expect(result.current.error).toMatch(/Network error/);
	expect(result.current.locked).toBe(false);
});
