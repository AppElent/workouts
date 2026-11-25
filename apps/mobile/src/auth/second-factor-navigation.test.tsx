/**
 * The second-factor step under the real router and `(auth)` layout: every
 * way out of it drops the Clerk attempt and lands on a clean sign-in.
 */
import { router } from "expo-router";
import {
	act,
	fireEvent,
	renderRouter,
	screen,
	waitFor,
} from "expo-router/testing-library";
import * as AuthLayout from "../../app/(auth)/_layout";
import * as ForgotPassword from "../../app/(auth)/forgot-password";
import * as ResetPassword from "../../app/(auth)/reset-password";
import * as SignIn from "../../app/(auth)/sign-in";
import * as SecondFactor from "../../app/(auth)/sign-in-second-factor";
import { LocaleProvider } from "../i18n";
import { AppearanceProvider } from "../theme";

const ok = { error: null };
const mockSignIn = {
	status: "needs_first_factor",
	supportedSecondFactors: [{ strategy: "totp" }, { strategy: "backup_code" }],
	create: jest.fn(),
	password: jest.fn(),
	emailCode: { sendCode: jest.fn() },
	resetPasswordEmailCode: {
		sendCode: jest.fn(),
		verifyCode: jest.fn(),
		submitPassword: jest.fn(),
	},
	mfa: { verifyTOTP: jest.fn(), sendPhoneCode: jest.fn() },
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
jest.mock("./config", () => ({ devLogin: null }));
jest.mock("./social-buttons", () => ({ SocialButtons: () => null }));

beforeEach(() => {
	jest.clearAllMocks();
	mockSignIn.status = "needs_first_factor";
	mockSignIn.reset.mockImplementation(async () => {
		mockSignIn.status = "needs_identifier";
	});
	mockSignIn.password.mockImplementation(async () => {
		mockSignIn.status = "needs_second_factor";
		return ok;
	});
});

function RootLayout() {
	const { Stack } = jest.requireActual("expo-router");
	return (
		<AppearanceProvider>
			<LocaleProvider>
				<Stack screenOptions={{ headerShown: false }} />
			</LocaleProvider>
		</AppearanceProvider>
	);
}

async function mount() {
	return await renderRouter(
		{
			_layout: RootLayout as never,
			"(auth)/_layout": AuthLayout as never,
			"(auth)/sign-in": SignIn as never,
			"(auth)/forgot-password": ForgotPassword as never,
			"(auth)/reset-password": ResetPassword as never,
			"(auth)/sign-in-second-factor": SecondFactor as never,
		},
		{ initialUrl: "/sign-in" },
	);
}

async function signInWithPassword() {
	await fireEvent.changeText(
		await screen.findByLabelText("Email"),
		"sam@example.test",
	);
	await fireEvent.changeText(screen.getByLabelText("Password"), "secret-1");
	await fireEvent.press(screen.getByTestId("sign-in-submit"));
}

it("moves a password sign-in on to the second factor", async () => {
	const app = await mount();
	await signInWithPassword();
	await waitFor(() => expect(app.getPathname()).toBe("/sign-in-second-factor"));
	expect(
		await screen.findByText(
			"Enter the 6-digit code from your authenticator app.",
		),
	).toBeTruthy();
	expect(mockSignIn.finalize).not.toHaveBeenCalled();
});

it("drops the attempt on Back to sign in", async () => {
	const app = await mount();
	await signInWithPassword();
	await fireEvent.press(
		await screen.findByRole("link", { name: "Back to sign in" }),
	);
	await waitFor(() => expect(app.getPathname()).toBe("/sign-in"));
	expect(mockSignIn.reset).toHaveBeenCalledTimes(1);
	// Sign-in is usable again, including the reset that shares the attempt.
	expect(
		screen.getByRole("link", { name: "Forgot password?" }),
	).not.toBeDisabled();
});

it("drops the attempt on a back gesture or Android back", async () => {
	const app = await mount();
	await signInWithPassword();
	await waitFor(() => expect(app.getPathname()).toBe("/sign-in-second-factor"));
	await act(() => router.back());
	await waitFor(() => expect(app.getPathname()).toBe("/sign-in"));
	expect(mockSignIn.reset).toHaveBeenCalledTimes(1);
});

it("continues a password reset into the second factor and back out", async () => {
	mockSignIn.resetPasswordEmailCode.verifyCode.mockResolvedValue(ok);
	mockSignIn.resetPasswordEmailCode.submitPassword.mockImplementation(
		async () => {
			mockSignIn.status = "needs_second_factor";
			return ok;
		},
	);
	const app = await mount();
	await act(() => router.push("/forgot-password?email=sam@example.test"));
	await act(() => router.push("/reset-password?email=sam@example.test"));
	await fireEvent.changeText(await screen.findByLabelText("Code"), "424242");
	await fireEvent(screen.getByLabelText("New password"), "submitEditing", {
		nativeEvent: { text: "a-new-password" },
	});
	await waitFor(() => expect(app.getPathname()).toBe("/sign-in-second-factor"));
	expect(
		await screen.findByText(
			"Your password is changed. One more step to sign in.",
		),
	).toBeTruthy();

	await fireEvent.press(screen.getByRole("link", { name: "Back to sign in" }));
	await waitFor(() => expect(app.getPathname()).toBe("/sign-in"));
	expect(mockSignIn.reset).toHaveBeenCalledTimes(1);
});
