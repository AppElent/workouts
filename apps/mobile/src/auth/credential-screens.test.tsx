import { fireEvent, screen } from "@testing-library/react-native";
import { LocaleProvider } from "../i18n";
import { renderThemed } from "../test-support/render-themed";
import { SignInScreen } from "./sign-in-screen";
import { SignUpScreen } from "./sign-up-screen";
import { CLERK_PASSWORD_RULES } from "./use-credential-field";

const mockSubmit = jest.fn();
const mockCreate = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));
jest.mock("./config", () => ({ devLogin: null }));
jest.mock("./social-buttons", () => ({ SocialButtons: () => null }));
jest.mock("./use-password-sign-in", () => ({
	usePasswordSignIn: () => ({ submit: mockSubmit, busy: false, error: null }),
}));
jest.mock("./use-email-code-sign-in", () => ({
	useEmailCodeSignIn: () => ({ send: jest.fn(), busy: false, error: null }),
}));
jest.mock("./use-sign-up", () => ({
	useSignUp: () => ({ create: mockCreate, busy: false, error: null }),
}));

afterEach(() => jest.clearAllMocks());

const render = (ui: React.ReactElement) =>
	renderThemed(ui, { wrapper: LocaleProvider });

/** What iOS AutoFill does: native text changes, only `onEndEditing` reports it. */
async function autofill(label: string, text: string) {
	await fireEvent(screen.getByLabelText(label), "endEditing", {
		nativeEvent: { text },
	});
}

describe("SignInScreen", () => {
	it("marks the fields for password managers", async () => {
		await render(<SignInScreen />);
		const email = screen.getByLabelText("Email");
		expect(email.props.autoComplete).toBe("username");
		expect(email.props.textContentType).toBe("username");
		const password = screen.getByLabelText("Password");
		expect(password.props.autoComplete).toBe("current-password");
		expect(password.props.textContentType).toBe("password");
	});

	it("signs in with text AutoFill set without onChangeText", async () => {
		await render(<SignInScreen />);
		await autofill("Email", "a@b.com");
		await autofill("Password", "saved-pw");
		await fireEvent.press(screen.getByTestId("sign-in-submit"));
		expect(mockSubmit).toHaveBeenCalledWith("a@b.com", "saved-pw");
	});

	it("submits the return key's latest text", async () => {
		await render(<SignInScreen />);
		await fireEvent.changeText(screen.getByLabelText("Email"), "a@b.com");
		await fireEvent(screen.getByLabelText("Password"), "submitEditing", {
			nativeEvent: { text: "filled-pw" },
		});
		expect(mockSubmit).toHaveBeenCalledWith("a@b.com", "filled-pw");
	});

	it("does not submit after AutoFill clears a field", async () => {
		await render(<SignInScreen />);
		await fireEvent.changeText(screen.getByLabelText("Email"), "a@b.com");
		await fireEvent.changeText(screen.getByLabelText("Password"), "pw");
		await autofill("Password", "");
		await fireEvent(screen.getByLabelText("Password"), "submitEditing", {
			nativeEvent: { text: "" },
		});
		expect(mockSubmit).not.toHaveBeenCalled();
	});
});

describe("SignUpScreen", () => {
	it("passes Clerk's password rules to the new-password field", async () => {
		await render(<SignUpScreen />);
		expect(screen.getByLabelText("Email").props.autoComplete).toBe("username");
		const password = screen.getByLabelText("Password");
		expect(password.props.autoComplete).toBe("new-password");
		expect(password.props.textContentType).toBe("newPassword");
		expect(password.props.passwordRules).toBe(CLERK_PASSWORD_RULES);
		expect(CLERK_PASSWORD_RULES).toBe("minlength: 8;");
	});

	it("creates the account with a generated password AutoFill set", async () => {
		mockCreate.mockResolvedValue(true);
		await render(<SignUpScreen />);
		await fireEvent.changeText(screen.getByLabelText("Email"), "a@b.com");
		await fireEvent(screen.getByLabelText("Password"), "submitEditing", {
			nativeEvent: { text: "Gen-erat-ed1" },
		});
		expect(mockCreate).toHaveBeenCalledWith("a@b.com", "Gen-erat-ed1");
	});

	it("keeps the field state when AutoFill clears a declined strong password", async () => {
		await render(<SignUpScreen />);
		await fireEvent.changeText(screen.getByLabelText("Email"), "a@b.com");
		await fireEvent.changeText(
			screen.getByLabelText("Password"),
			"Gen-erat-ed1",
		);
		await autofill("Password", "");
		expect(screen.getByLabelText("Password").props.value).toBe("");
		await fireEvent(screen.getByLabelText("Password"), "submitEditing", {
			nativeEvent: { text: "" },
		});
		expect(mockCreate).not.toHaveBeenCalled();
	});
});
