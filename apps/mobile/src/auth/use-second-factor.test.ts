import { act, renderHook } from "@testing-library/react-native";
import { LocaleProvider } from "../i18n";
import {
	PREFERENCE_KEYS,
	removeLocal,
	writeLocal,
} from "../local-store/local-store";
import { secondFactorOptions } from "./second-factor";
import { useSecondFactor, useSecondFactorHandoff } from "./use-second-factor";

const ok = { error: null };
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
const mockPush = jest.fn();

const mockErrors = { fields: {}, global: null as { code: string }[] | null };

jest.mock("@clerk/expo", () => ({
	useSignIn: () => ({ signIn: mockSignIn, errors: mockErrors }),
}));
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
}));

const TOTP = { strategy: "totp" };
const BACKUP = { strategy: "backup_code" };
const PHONE = { strategy: "phone_code", safeIdentifier: "+1******0100" };
const EMAIL = { strategy: "email_code", safeIdentifier: "s***@example.test" };

beforeEach(() => {
	jest.resetAllMocks();
	mockErrors.global = null;
	mockSignIn.status = "needs_second_factor";
	mockSignIn.supportedSecondFactors = [BACKUP, TOTP];
	for (const fn of Object.values(mockMfa)) fn.mockResolvedValue(ok);
	mockSignIn.finalize.mockResolvedValue(ok);
});
afterEach(() => removeLocal(PREFERENCE_KEYS.locale));

async function mount(sent = false) {
	const markSent = jest.fn();
	const hook = await renderHook(() => useSecondFactor({ sent, markSent }), {
		wrapper: LocaleProvider,
	});
	return { ...hook, markSent };
}

describe("secondFactorOptions", () => {
	it("orders methods authenticator, text, email, backup and drops the rest", () => {
		expect(
			secondFactorOptions([
				BACKUP,
				{ strategy: "passkey" },
				EMAIL,
				PHONE,
				TOTP,
			]).map((option) => option.strategy),
		).toEqual(["totp", "phone_code", "email_code", "backup_code"]);
	});

	it("keeps the masked destination of a texted code", () => {
		expect(secondFactorOptions([PHONE])).toEqual([PHONE]);
	});

	it("has nothing to offer for a passkey-only account", () => {
		expect(secondFactorOptions([{ strategy: "passkey" }])).toEqual([]);
		expect(secondFactorOptions(null)).toEqual([]);
	});
});

it("opens the second-factor screen from a reset", async () => {
	const { result } = await renderHook(() => useSecondFactorHandoff());
	result.current("reset");
	expect(mockPush).toHaveBeenCalledWith({
		pathname: "/sign-in-second-factor",
		params: { from: "reset" },
	});
});

it("defaults to the authenticator app and sends nothing", async () => {
	const { result, markSent } = await mount();
	expect(result.current.strategy).toBe("totp");
	expect(mockMfa.sendPhoneCode).not.toHaveBeenCalled();
	expect(markSent).not.toHaveBeenCalled();
});

it("verifies an authenticator code and finalizes the session", async () => {
	const { result } = await mount();
	await act(() => result.current.verify(" 123456 "));
	expect(mockMfa.verifyTOTP).toHaveBeenCalledWith({ code: "123456" });
	expect(mockSignIn.finalize).toHaveBeenCalled();
});

it("does not finalize after a wrong code", async () => {
	mockMfa.verifyTOTP.mockResolvedValue({
		error: { code: "form_code_incorrect" },
	});
	const { result } = await mount();
	await act(() => result.current.verify("000000"));
	expect(mockSignIn.finalize).not.toHaveBeenCalled();
	expect(result.current.error).toMatch(/code is not right/i);
	expect(result.current.ended).toBe(false);
	expect(result.current.busy).toBe(false);
});

it("explains a wrong code in Dutch", async () => {
	writeLocal(PREFERENCE_KEYS.locale, "nl");
	mockMfa.verifyTOTP.mockResolvedValue({
		error: { code: "form_code_incorrect" },
	});
	const { result } = await mount();
	await act(() => result.current.verify("000000"));
	expect(result.current.error).toBe("Die code klopt niet.");
});

it.each([
	["an expired sign-in", "sign_in_expired"],
	["a dropped sign-in", "resource_not_found"],
])("ends the attempt after %s", async (_, code) => {
	mockMfa.verifyTOTP.mockResolvedValue({ error: { code } });
	const { result } = await mount();
	await act(() => result.current.verify("000000"));
	expect(result.current.ended).toBe(true);
	await act(() => result.current.verify("123456"));
	expect(mockMfa.verifyTOTP).toHaveBeenCalledTimes(1);
});

it("locks the authenticator app after too many wrong codes, and a backup code still signs in", async () => {
	mockMfa.verifyTOTP.mockResolvedValue({
		error: { code: "verification_failed" },
	});
	const { result } = await mount();
	await act(() => result.current.verify("000000"));
	expect(result.current.ended).toBe(false);
	expect(result.current.locked).toBe(true);
	// Clerk keeps the failure in its errors signal until the next request.
	mockErrors.global = [{ code: "verification_failed" }];
	await act(() => result.current.verify("123456"));
	expect(mockMfa.verifyTOTP).toHaveBeenCalledTimes(1);

	await act(async () => {
		await result.current.switchTo("backup_code");
	});
	expect(result.current.locked).toBe(false);
	// The authenticator app's lock is not the backup code's error.
	expect(result.current.error).toBeNull();
	// Back on the authenticator app, it is still locked.
	await act(async () => {
		await result.current.switchTo("totp");
	});
	expect(result.current.locked).toBe(true);

	await act(async () => {
		await result.current.switchTo("backup_code");
	});
	await act(() => result.current.verify("abcd1234"));
	expect(mockMfa.verifyBackupCode).toHaveBeenCalledWith({ code: "abcd1234" });
	expect(mockSignIn.finalize).toHaveBeenCalled();
});

it("unlocks a texted code with a new one, which signs in", async () => {
	mockSignIn.supportedSecondFactors = [PHONE];
	mockMfa.verifyPhoneCode.mockResolvedValueOnce({
		error: { code: "verification_failed" },
	});
	const { result } = await mount(true);
	await act(() => result.current.verify("000000"));
	expect(result.current.locked).toBe(true);
	expect(result.current.ended).toBe(false);
	expect(result.current.error).toMatch(/too many wrong codes/i);

	let sent = false;
	await act(async () => {
		sent = await result.current.resend();
	});
	expect(sent).toBe(true);
	expect(mockMfa.sendPhoneCode).toHaveBeenCalledTimes(1);
	expect(result.current.locked).toBe(false);
	expect(result.current.error).toBeNull();
	await act(() => result.current.verify("424242"));
	expect(mockMfa.verifyPhoneCode).toHaveBeenLastCalledWith({ code: "424242" });
	expect(mockSignIn.finalize).toHaveBeenCalled();
});

it("keeps a texted code locked when the new one fails to send", async () => {
	mockSignIn.supportedSecondFactors = [PHONE];
	mockMfa.verifyPhoneCode.mockResolvedValue({
		error: { code: "verification_failed" },
	});
	mockMfa.sendPhoneCode.mockResolvedValue({
		error: { code: "too_many_requests" },
	});
	const { result } = await mount(true);
	await act(() => result.current.verify("000000"));
	await act(async () => {
		await result.current.resend();
	});
	expect(result.current.locked).toBe(true);
	expect(result.current.error).toMatch(/too many attempts/i);
});

it("finds the code of a thrown-style API error nested in errors[]", async () => {
	mockMfa.verifyTOTP.mockResolvedValue({
		error: {
			code: "api_response_error",
			errors: [{ code: "verification_failed" }],
		},
	});
	const { result } = await mount();
	await act(() => result.current.verify("000000"));
	expect(result.current.locked).toBe(true);
});

it("switches to a backup code and verifies with it", async () => {
	const { result } = await mount();
	await act(async () => {
		await result.current.switchTo("backup_code");
	});
	expect(result.current.strategy).toBe("backup_code");
	await act(() => result.current.verify("abcd1234"));
	expect(mockMfa.verifyBackupCode).toHaveBeenCalledWith({ code: "abcd1234" });
	expect(mockMfa.verifyTOTP).not.toHaveBeenCalled();
	expect(mockSignIn.finalize).toHaveBeenCalled();
});

it("sends a texted default's code once, on the first mount only", async () => {
	mockSignIn.supportedSecondFactors = [PHONE, BACKUP];
	const first = await mount();
	expect(first.result.current.strategy).toBe("phone_code");
	expect(mockMfa.sendPhoneCode).toHaveBeenCalledTimes(1);
	expect(first.markSent).toHaveBeenCalledTimes(1);
	await first.unmount();

	await mount(true);
	expect(mockMfa.sendPhoneCode).toHaveBeenCalledTimes(1);
});

it("verifies a texted code with the phone method", async () => {
	mockSignIn.supportedSecondFactors = [PHONE];
	const { result } = await mount(true);
	await act(() => result.current.verify("424242"));
	expect(mockMfa.verifyPhoneCode).toHaveBeenCalledWith({ code: "424242" });
});

it("sends an emailed code when switching to it, and only once", async () => {
	mockSignIn.supportedSecondFactors = [TOTP, EMAIL];
	const { result } = await mount();
	await act(async () => {
		await result.current.switchTo("email_code");
	});
	expect(mockMfa.sendEmailCode).toHaveBeenCalledTimes(1);
	expect(result.current.strategy).toBe("email_code");
	await act(() => result.current.verify("123456"));
	expect(mockMfa.verifyEmailCode).toHaveBeenCalledWith({ code: "123456" });
});

it("stays on the current method when the switch's code fails to send", async () => {
	mockSignIn.supportedSecondFactors = [TOTP, PHONE];
	mockMfa.sendPhoneCode.mockResolvedValue({
		error: { code: "too_many_requests" },
	});
	const { result } = await mount();
	let switched = true;
	await act(async () => {
		switched = await result.current.switchTo("phone_code");
	});
	expect(switched).toBe(false);
	expect(result.current.strategy).toBe("totp");
	expect(result.current.error).toMatch(/too many attempts/i);
});

it("shows a resend that throws as a network error", async () => {
	mockSignIn.supportedSecondFactors = [PHONE];
	mockMfa.sendPhoneCode.mockRejectedValue(new Error("offline"));
	const { result } = await mount(true);
	let sent = true;
	await act(async () => {
		sent = await result.current.resend();
	});
	expect(sent).toBe(false);
	expect(result.current.error).toMatch(/network error/i);
	expect(result.current.sending).toBe(false);
});

it("has nothing to resend for an authenticator app", async () => {
	const { result } = await mount();
	let sent = true;
	await act(async () => {
		sent = await result.current.resend();
	});
	expect(sent).toBe(false);
	expect(mockMfa.sendPhoneCode).not.toHaveBeenCalled();
});

it("drops the attempt on cancel, even when that throws", async () => {
	mockSignIn.reset.mockRejectedValue(new Error("offline"));
	const { result } = await mount();
	await act(() => result.current.cancel());
	expect(mockSignIn.reset).toHaveBeenCalled();
	expect(result.current.error).toBeNull();
});

it("has no method when the account offers none this app supports", async () => {
	mockSignIn.supportedSecondFactors = [{ strategy: "passkey" }];
	const { result } = await mount();
	expect(result.current.strategy).toBeNull();
	await act(() => result.current.verify("123456"));
	expect(mockSignIn.finalize).not.toHaveBeenCalled();
});

it("retries only finalize() after it failed on a verified code", async () => {
	mockSignIn.finalize.mockResolvedValueOnce({
		error: { code: "network_error" },
	});
	mockMfa.verifyTOTP.mockImplementation(async () => {
		mockSignIn.status = "complete";
		return ok;
	});
	const { result } = await mount();
	await act(() => result.current.verify("123456"));
	expect(result.current.error).toMatch(/network error/i);
	await act(() => result.current.verify("123456"));
	expect(mockMfa.verifyTOTP).toHaveBeenCalledTimes(1);
	expect(mockSignIn.finalize).toHaveBeenCalledTimes(2);
});

it("keeps the methods it opened with after the attempt is dropped", async () => {
	const { result, rerender } = await mount();
	mockSignIn.supportedSecondFactors = [];
	await act(() => result.current.cancel());
	await rerender({});
	expect(result.current.options.map((o) => o.strategy)).toEqual([
		"totp",
		"backup_code",
	]);
});
