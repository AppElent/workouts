import { act, renderHook } from "@testing-library/react-native";
import { LocaleProvider } from "../i18n";
import { usePasswordSignIn } from "./use-password-sign-in";

const ok = { error: null };
const mockSignIn = {
	status: "needs_identifier",
	password: jest.fn(),
	finalize: jest.fn(),
};
const mockPush = jest.fn();

jest.mock("@clerk/expo", () => ({
	useSignIn: () => ({
		signIn: mockSignIn,
		errors: { fields: {}, global: null },
	}),
}));
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
	jest.resetAllMocks();
	mockSignIn.finalize.mockResolvedValue(ok);
});

function signInEndsAt(status: string) {
	mockSignIn.password.mockImplementation(async () => {
		mockSignIn.status = status;
		return ok;
	});
}

async function submit() {
	const hook = await renderHook(() => usePasswordSignIn(), {
		wrapper: LocaleProvider,
	});
	await act(() => hook.result.current.submit(" sam@example.test ", "pw"));
	return hook.result.current;
}

it("finalizes a complete sign-in", async () => {
	signInEndsAt("complete");
	await submit();
	expect(mockSignIn.password).toHaveBeenCalledWith({
		identifier: "sam@example.test",
		password: "pw",
	});
	expect(mockSignIn.finalize).toHaveBeenCalled();
	expect(mockPush).not.toHaveBeenCalled();
});

it.each(["needs_second_factor", "needs_client_trust"])(
	"opens the second-factor step at %s",
	async (status) => {
		signInEndsAt(status);
		const result = await submit();
		expect(mockPush).toHaveBeenCalledWith({
			pathname: "/sign-in-second-factor",
			params: { from: "signIn" },
		});
		expect(mockSignIn.finalize).not.toHaveBeenCalled();
		expect(result.busy).toBe(false);
		expect(result.error).toBeNull();
	},
);

it("explains a step the app cannot do", async () => {
	signInEndsAt("needs_protect_check");
	const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
	const result = await submit();
	expect(mockPush).not.toHaveBeenCalled();
	expect(result.error).toMatch(/doesn't support yet/);
	warn.mockRestore();
});
