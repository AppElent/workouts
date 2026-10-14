import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useSocialSignIn } from "./useSocialSignIn";

const mockStartSSOFlow = jest.fn();
const mockStartApple = jest.fn();
const mockSetActive = jest.fn();

jest.mock("@clerk/expo/experimental", () => ({
	useSSO: () => ({ startSSOFlow: mockStartSSOFlow }),
}));
jest.mock("@clerk/expo/apple", () => ({
	useSignInWithApple: () => ({ startAppleAuthenticationFlow: mockStartApple }),
}));

const originalOS = Platform.OS;

afterEach(() => {
	jest.resetAllMocks();
	Platform.OS = originalOS;
});

async function run(provider: "apple" | "google" | "microsoft") {
	const hook = renderHook(() => useSocialSignIn());
	await act(() => hook.result.current.start(provider));
	return hook.result.current;
}

it("opens Microsoft in the browser flow", async () => {
	mockStartSSOFlow.mockResolvedValue({
		createdSessionId: "s1",
		authSessionResult: { type: "success" },
	});
	const result = await run("microsoft");
	expect(mockStartSSOFlow).toHaveBeenCalledWith({
		strategy: "oauth_microsoft",
	});
	expect(result.error).toBeNull();
});

it("says nothing when the browser is dismissed", async () => {
	mockStartSSOFlow.mockResolvedValue({
		createdSessionId: null,
		authSessionResult: { type: "dismiss" },
	});
	const result = await run("google");
	expect(result.error).toBeNull();
	expect(result.pending).toBeNull();
});

it("explains a sign-up that needs steps the app cannot do", async () => {
	mockStartSSOFlow.mockResolvedValue({
		createdSessionId: null,
		signIn: { existingSession: undefined },
		authSessionResult: { type: "success" },
	});
	const result = await run("google");
	expect(result.error).toMatch(/finish signing up on the web/i);
});

it("uses the native Apple sheet on iOS and activates its session", async () => {
	Platform.OS = "ios";
	mockStartApple.mockResolvedValue({
		createdSessionId: "s2",
		setActive: mockSetActive,
	});
	await run("apple");
	expect(mockStartSSOFlow).not.toHaveBeenCalled();
	expect(mockSetActive).toHaveBeenCalledWith({ session: "s2" });
});

it("falls back to the browser for Apple on Android", async () => {
	Platform.OS = "android";
	mockStartSSOFlow.mockResolvedValue({
		createdSessionId: "s3",
		authSessionResult: { type: "success" },
	});
	await run("apple");
	expect(mockStartApple).not.toHaveBeenCalled();
	expect(mockStartSSOFlow).toHaveBeenCalledWith({ strategy: "oauth_apple" });
});

it("treats cancelling the Apple sheet as a non-error", async () => {
	Platform.OS = "ios";
	mockStartApple.mockRejectedValue({
		code: "ERR_REQUEST_CANCELED",
	});
	const result = await run("apple");
	expect(result.error).toBeNull();
	expect(result.pending).toBeNull();
});

it("maps a thrown Clerk error to readable copy", async () => {
	mockStartSSOFlow.mockRejectedValue({ errors: [{ code: "network_error" }] });
	const result = await run("google");
	expect(result.error).toMatch(/network error/i);
});

it("points to Settings when the device has no Apple Account", async () => {
	Platform.OS = "ios";
	mockStartApple.mockRejectedValue({ code: "ERR_REQUEST_UNKNOWN" });
	const result = await run("apple");
	expect(result.error).toMatch(/apple account in settings/i);
});
