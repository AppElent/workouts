/**
 * The reset screens under the real router and `(auth)` layout: leaving while
 * Clerk works would let ordinary sign-in overlap the reset on one attempt.
 */
import { router } from "expo-router";
import {
	act,
	fireEvent,
	renderRouter,
	screen,
	waitFor,
} from "expo-router/testing-library";
import { Text } from "react-native";
import * as AuthLayout from "../../app/(auth)/_layout";
import * as ForgotPassword from "../../app/(auth)/forgot-password";
import * as ResetPassword from "../../app/(auth)/reset-password";
import { LocaleProvider } from "../i18n";
import { AppearanceProvider } from "../theme";

const mockSignIn = {
	status: "needs_first_factor",
	create: jest.fn(),
	resetPasswordEmailCode: { sendCode: jest.fn() },
	reset: jest.fn(),
};
jest.mock("@clerk/expo", () => ({
	useAuth: () => ({ isSignedIn: false }),
	useSignIn: () => ({
		signIn: mockSignIn,
		errors: { fields: {}, global: null },
	}),
}));

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
			"(auth)/sign-in": (() => <Text>Sign-in screen</Text>) as never,
			"(auth)/forgot-password": ForgotPassword as never,
			"(auth)/reset-password": ResetPassword as never,
		},
		{ initialUrl: "/sign-in" },
	);
}

it("stays on the request screen when going back during a pending send", async () => {
	let release: (result: { error: null }) => void = () => {};
	mockSignIn.create.mockResolvedValue({ error: null });
	mockSignIn.resetPasswordEmailCode.sendCode.mockImplementation(
		() =>
			new Promise((resolve) => {
				release = resolve;
			}),
	);
	const app = await mount();
	await act(() => router.push("/forgot-password?email=sam@example.test"));
	const pressing = fireEvent.press(
		await screen.findByRole("button", { name: "Send code" }),
	);
	// Let the press's own act() settle (renderRouter fakes timers) so only the
	// handler stays pending and later act() calls do not overlap it.
	for (let tick = 0; tick < 20; tick++) await Promise.resolve();
	expect(mockSignIn.resetPasswordEmailCode.sendCode).toHaveBeenCalled();

	await act(() => router.back());
	expect(app.getPathname()).toBe("/forgot-password");

	await act(async () => release({ error: null }));
	await pressing;
	expect(app.getPathname()).toBe("/reset-password");
	await act(() => router.back());
	expect(app.getPathname()).toBe("/forgot-password");
});

it("still goes back for a different email once the start-over settles", async () => {
	mockSignIn.reset.mockResolvedValue(undefined);
	const app = await mount();
	await act(() => router.push("/forgot-password?email=sam@example.test"));
	await act(() => router.push("/reset-password?email=sam@example.test"));
	await fireEvent.press(
		await screen.findByRole("link", { name: "Use a different email" }),
	);
	expect(mockSignIn.reset).toHaveBeenCalled();
	await waitFor(() => expect(app.getPathname()).toBe("/forgot-password"));
});
