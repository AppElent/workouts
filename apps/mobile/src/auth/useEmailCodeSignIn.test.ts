import { act, renderHook } from "@testing-library/react-native";
import { useEmailCodeSignIn } from "./useEmailCodeSignIn";

const mockSendCode = jest.fn();
const mockVerifyCode = jest.fn();
const mockFinalize = jest.fn();
const mockReset = jest.fn();
const mockErrors = { fields: {}, global: null };

jest.mock("@clerk/expo", () => ({
	useSignIn: () => ({
		signIn: {
			emailCode: { sendCode: mockSendCode, verifyCode: mockVerifyCode },
			finalize: mockFinalize,
			reset: mockReset,
		},
		errors: mockErrors,
	}),
}));

afterEach(() => jest.resetAllMocks());

it("sends a code to the trimmed address", async () => {
	mockSendCode.mockResolvedValue({ error: null });
	const { result } = renderHook(() => useEmailCodeSignIn());
	let sent = false;
	await act(async () => {
		sent = await result.current.send("  a@b.com ");
	});
	expect(mockSendCode).toHaveBeenCalledWith({ emailAddress: "a@b.com" });
	expect(sent).toBe(true);
});

it("reports a failed send and stays on the screen", async () => {
	mockSendCode.mockResolvedValue({
		error: { code: "form_identifier_not_found" },
	});
	const { result } = renderHook(() => useEmailCodeSignIn());
	let sent = true;
	await act(async () => {
		sent = await result.current.send("nobody@b.com");
	});
	expect(sent).toBe(false);
	expect(result.current.error).toMatch(/no account found/i);
});

it("verifies the code and finalizes the session", async () => {
	mockVerifyCode.mockResolvedValue({ error: null });
	mockFinalize.mockResolvedValue({ error: null });
	const { result } = renderHook(() => useEmailCodeSignIn());
	await act(() => result.current.verify("123456"));
	expect(mockVerifyCode).toHaveBeenCalledWith({ code: "123456" });
	expect(mockFinalize).toHaveBeenCalled();
});

it("does not finalize when the code is wrong", async () => {
	mockVerifyCode.mockResolvedValue({ error: { code: "form_code_incorrect" } });
	const { result } = renderHook(() => useEmailCodeSignIn());
	await act(() => result.current.verify("000000"));
	expect(mockFinalize).not.toHaveBeenCalled();
	expect(result.current.error).toMatch(/code is not right/i);
	expect(result.current.busy).toBe(false);
});

it("starts over so a corrected address gets a fresh sign-in", async () => {
	mockReset.mockResolvedValue({ error: null });
	const { result } = renderHook(() => useEmailCodeSignIn());
	await act(() => result.current.startOver());
	expect(mockReset).toHaveBeenCalled();
});

it("ignores a second resend while one is in flight", async () => {
	let settle: (v: { error: null }) => void = () => {};
	mockSendCode.mockReturnValue(
		new Promise((resolve) => {
			settle = resolve;
		}),
	);
	const { result } = renderHook(() => useEmailCodeSignIn());
	let first: Promise<boolean> = Promise.resolve(false);
	act(() => {
		first = result.current.resend();
	});
	expect(result.current.resending).toBe(true);
	let second = true;
	await act(async () => {
		second = await result.current.resend();
	});
	expect(second).toBe(false);
	await act(async () => {
		settle({ error: null });
		await first;
	});
	expect(mockSendCode).toHaveBeenCalledTimes(1);
	expect(result.current.resending).toBe(false);
});
