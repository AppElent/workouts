import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { ConvexError } from "convex/values";
import { beforeEach, expect, it, vi } from "vitest";
import { ConfirmDialogProvider } from "#/components/ui/confirm-dialog";
import { ToastHost } from "#/components/ui/toast";
import { LocaleProvider } from "#/lib/i18n";
import { DeleteAccountCard } from "./DeleteAccountCard";

const mocks = vi.hoisted(() => ({
	blocker: null as "activeActivity" | "hostedWorkout" | null | undefined,
	online: true,
	deleteData: vi.fn(),
	revokeAction: vi.fn(),
	revokeApple: vi.fn(),
	deleteUser: vi.fn(),
	navigate: vi.fn(),
	deleteSelfEnabled: true,
	// Whether the session's sign-in is recent enough for Clerk.
	recentSignIn: true,
	// How the person answers Clerk's verify dialog.
	verifies: true,
	verifyPrompts: 0,
	// Whether completing the dialog makes the sign-in recent.
	verifyRefreshes: true,
	appleReturnUrl: null as string | null,
}));

type Fetcher = (...args: unknown[]) => Promise<unknown>;
const cancelled = { code: "reverification_cancelled" };

vi.mock("convex/react", () => ({
	useQuery: () => mocks.blocker,
	useMutation: () => mocks.deleteData,
	useAction: () => mocks.revokeAction,
	useConvexConnectionState: () => ({ isWebSocketConnected: mocks.online }),
}));
vi.mock("@clerk/react", () => ({
	useAuth: () => ({ userId: "user_1" }),
	useClerk: () => ({
		session: { checkAuthorization: () => mocks.recentSignIn },
	}),
	// Mirrors Clerk: a reverification hint, or Clerk's
	// session_reverification_required error, opens the verify dialog, then the
	// call runs again; cancelling it rejects.
	useReverification:
		(fetcher: Fetcher) =>
		async (...args: unknown[]) => {
			const attempt = () =>
				fetcher(...args).catch((error: { reverify?: boolean }) => {
					if (error?.reverify)
						return { clerk_error: { reason: "reverification-error" } };
					throw error;
				});
			const result = (await attempt()) as { clerk_error?: unknown } | undefined;
			if (!result?.clerk_error) return result;
			mocks.verifyPrompts++;
			if (!mocks.verifies) throw cancelled;
			if (mocks.verifyRefreshes) mocks.recentSignIn = true;
			return attempt();
		},
	useUser: () => ({
		user: {
			deleteSelfEnabled: mocks.deleteSelfEnabled,
			externalAccounts: [],
			delete: mocks.deleteUser,
		},
	}),
}));
vi.mock("@clerk/react/errors", () => ({
	isReverificationCancelledError: (error: unknown) => error === cancelled,
}));
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));
vi.mock("#/lib/auth/appleRevocation", () => ({
	revokeAppleSignIn: mocks.revokeApple,
	preloadAppleJs: () => {},
	appleRevocationReturnUrl: () => mocks.appleReturnUrl,
}));

beforeEach(() => {
	vi.clearAllMocks();
	mocks.blocker = null;
	mocks.online = true;
	mocks.deleteSelfEnabled = true;
	mocks.recentSignIn = true;
	mocks.verifies = true;
	mocks.verifyPrompts = 0;
	mocks.verifyRefreshes = true;
	mocks.appleReturnUrl = null;
	mocks.deleteData.mockResolvedValue({ done: true });
	mocks.revokeApple.mockResolvedValue("continue");
	mocks.deleteUser.mockResolvedValue(undefined);
});

function setup() {
	render(
		<LocaleProvider initialLocale="en">
			<ToastHost>
				<ConfirmDialogProvider>
					<DeleteAccountCard />
				</ConfirmDialogProvider>
			</ToastHost>
		</LocaleProvider>,
	);
}

const button = (name: string) =>
	screen.getByRole<HTMLButtonElement>("button", { name });
const dialog = () => within(screen.getByRole("alertdialog"));
const notifications = () =>
	within(screen.getByRole("region", { name: "Notifications" }));

it("disables both actions and explains why while deletion is blocked", () => {
	mocks.blocker = "activeActivity";
	setup();
	expect(button("Delete my data").disabled).toBe(true);
	expect(button("Delete account").disabled).toBe(true);
	expect(screen.getByRole("status").textContent).toBe(
		"Finish or cancel the running Activity before deleting your data.",
	);
});

it("stays disabled until the blocker is known", () => {
	mocks.blocker = undefined;
	setup();
	expect(button("Delete my data").disabled).toBe(true);
	expect(button("Delete account").disabled).toBe(true);
});

it("stays disabled offline and says why", () => {
	mocks.online = false;
	setup();
	expect(button("Delete my data").disabled).toBe(true);
	expect(button("Delete account").disabled).toBe(true);
	expect(screen.getByRole("status").textContent).toBe(
		"Connect to delete your data.",
	);
});

it("offers no account deletion when the Clerk instance disables it", () => {
	mocks.deleteSelfEnabled = false;
	setup();
	expect(button("Delete my data").disabled).toBe(false);
	expect(button("Delete account").disabled).toBe(true);
	expect(
		screen.getByText(/Account deletion is turned off for this app/),
	).toBeTruthy();
});

it("deletes nothing when the confirmation is cancelled", async () => {
	setup();
	fireEvent.click(button("Delete my data"));
	expect(dialog().getByText(/will be permanently removed/)).toBeTruthy();
	fireEvent.click(dialog().getByRole("button", { name: "Cancel" }));
	await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
	expect(mocks.deleteData).not.toHaveBeenCalled();
});

it("deletes data in batches until done, then confirms", async () => {
	mocks.deleteData
		.mockResolvedValueOnce({ done: false })
		.mockResolvedValueOnce({ done: true });
	setup();
	fireEvent.click(button("Delete my data"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete my data" }));
	expect(
		await notifications().findByText("Your data was deleted."),
	).toBeTruthy();
	expect(mocks.deleteData).toHaveBeenCalledTimes(2);
	expect(mocks.deleteData).toHaveBeenCalledWith({ expectedSubject: "user_1" });
	expect(mocks.revokeApple).not.toHaveBeenCalled();
	expect(mocks.deleteUser).not.toHaveBeenCalled();
});

it("shows the server's refusal when deleting fails", async () => {
	mocks.deleteData.mockRejectedValue(
		new ConvexError({ code: "hostedWorkout" }),
	);
	setup();
	fireEvent.click(button("Delete my data"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete my data" }));
	expect(
		await notifications().findByText(
			/involved in a Hosted Workout\. Deleting is unavailable/,
		),
	).toBeTruthy();
	expect(button("Delete my data").disabled).toBe(false);
});

it("says deleting stopped when a batch fails without a code", async () => {
	mocks.deleteData.mockRejectedValue(new Error("network"));
	setup();
	fireEvent.click(button("Delete my data"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete my data" }));
	expect(
		await notifications().findByText(/Deleting stopped before it finished/),
	).toBeTruthy();
});

it("revokes Apple, deletes data, deletes the account, then leaves for the start", async () => {
	setup();
	fireEvent.click(button("Delete account"));
	expect(
		dialog().getByText(/your account is deleted and you are signed out/),
	).toBeTruthy();
	fireEvent.click(dialog().getByRole("button", { name: "Delete account" }));
	await waitFor(() =>
		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/",
			replace: true,
			reloadDocument: true,
		}),
	);
	expect(mocks.revokeApple.mock.invocationCallOrder[0]).toBeLessThan(
		mocks.deleteData.mock.invocationCallOrder[0],
	);
	expect(mocks.deleteData.mock.invocationCallOrder[0]).toBeLessThan(
		mocks.deleteUser.mock.invocationCallOrder[0],
	);
});

it("cancels account deletion when the Apple popup is closed", async () => {
	mocks.revokeApple.mockResolvedValue("cancelled");
	setup();
	fireEvent.click(button("Delete account"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete account" }));
	await waitFor(() => expect(mocks.revokeApple).toHaveBeenCalled());
	expect(mocks.deleteData).not.toHaveBeenCalled();
	expect(mocks.deleteUser).not.toHaveBeenCalled();
});

it("keeps the person here when Clerk refuses to delete the account", async () => {
	mocks.deleteUser.mockRejectedValue(new Error("forbidden"));
	setup();
	fireEvent.click(button("Delete account"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete account" }));
	expect(
		await notifications().findByText(
			/the account could not be deleted\. Try Delete account again/,
		),
	).toBeTruthy();
	expect(mocks.navigate).not.toHaveBeenCalled();
});

it("ignores further clicks while a deletion runs", async () => {
	let finish = (_: { done: boolean }) => {};
	mocks.deleteData.mockReturnValue(
		new Promise((resolve) => {
			finish = resolve;
		}),
	);
	setup();
	fireEvent.click(button("Delete my data"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete my data" }));
	await waitFor(() => expect(button("Delete my data").disabled).toBe(true));
	expect(button("Delete account").disabled).toBe(true);
	fireEvent.click(button("Delete account"));
	expect(screen.queryByRole("alertdialog")).toBeNull();
	finish({ done: true });
	await notifications().findByText("Your data was deleted.");
	expect(mocks.deleteData).toHaveBeenCalledTimes(1);
});

it("keeps the account when deleting its data fails", async () => {
	mocks.deleteData.mockRejectedValue(new Error("network"));
	setup();
	fireEvent.click(button("Delete account"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete account" }));
	await notifications().findByText(/Deleting stopped before it finished/);
	expect(mocks.deleteUser).not.toHaveBeenCalled();
	expect(mocks.navigate).not.toHaveBeenCalled();
});

it("stops and asks to allow pop-ups when the browser blocks the Apple window", async () => {
	mocks.revokeApple.mockResolvedValue("popupBlocked");
	setup();
	fireEvent.click(button("Delete account"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete account" }));
	await notifications().findByText(/Allow pop-ups for this site/);
	expect(mocks.deleteData).not.toHaveBeenCalled();
	expect(mocks.deleteUser).not.toHaveBeenCalled();
});

it("asks to confirm an old sign-in before deleting anything, then deletes", async () => {
	mocks.recentSignIn = false;
	setup();
	fireEvent.click(button("Delete account"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete account" }));
	await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
	expect(mocks.verifyPrompts).toBe(1);
	expect(mocks.deleteUser).toHaveBeenCalledOnce();
});

it("deletes nothing when confirming the sign-in is cancelled", async () => {
	mocks.recentSignIn = false;
	mocks.verifies = false;
	setup();
	fireEvent.click(button("Delete account"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete account" }));
	await waitFor(() => expect(mocks.verifyPrompts).toBe(1));
	await waitFor(() => expect(button("Delete account").disabled).toBe(false));
	expect(mocks.revokeApple).not.toHaveBeenCalled();
	expect(mocks.deleteData).not.toHaveBeenCalled();
	expect(mocks.deleteUser).not.toHaveBeenCalled();
	expect(
		screen.queryByRole("region", { name: "Notifications" })?.textContent ?? "",
	).not.toMatch(/deleted/);
});

it("asks to confirm the sign-in again when Clerk asks once the data is gone and it is cancelled", async () => {
	mocks.deleteUser.mockRejectedValue({ reverify: true });
	mocks.verifies = false;
	setup();
	fireEvent.click(button("Delete account"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete account" }));
	expect(
		await notifications().findByText(
			/Your data was deleted, but the account was not.*Choose Delete account again and confirm your sign-in/,
		),
	).toBeTruthy();
	expect(mocks.deleteData).toHaveBeenCalled();
	expect(mocks.navigate).not.toHaveBeenCalled();
});

it("deletes nothing when the sign-in is still old after Clerk's dialog", async () => {
	mocks.recentSignIn = false;
	mocks.verifyRefreshes = false;
	setup();
	fireEvent.click(button("Delete account"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete account" }));
	expect(
		await notifications().findByText(
			/Your sign-in could not be confirmed\. Nothing was deleted/,
		),
	).toBeTruthy();
	expect(mocks.revokeApple).not.toHaveBeenCalled();
	expect(mocks.deleteData).not.toHaveBeenCalled();
	expect(mocks.deleteUser).not.toHaveBeenCalled();
});

it("stays here when Clerk refuses the account again after its dialog", async () => {
	mocks.deleteUser.mockRejectedValue({ reverify: true });
	setup();
	fireEvent.click(button("Delete account"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete account" }));
	expect(
		await notifications().findByText(
			/Choose Delete account again and confirm your sign-in/,
		),
	).toBeTruthy();
	expect(mocks.deleteUser).toHaveBeenCalledTimes(2);
	expect(mocks.navigate).not.toHaveBeenCalled();
});

it("asks for a fresh click before Apple's window after confirming the sign-in", async () => {
	mocks.recentSignIn = false;
	mocks.appleReturnUrl = "https://foundry.appelent.nl/account";
	setup();
	fireEvent.click(button("Delete account"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete account" }));
	expect(
		await screen.findByText(/Next, Apple asks you to sign in/),
	).toBeTruthy();
	expect(mocks.revokeApple).not.toHaveBeenCalled();
	fireEvent.click(dialog().getByRole("button", { name: "Delete account" }));
	await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
	expect(mocks.revokeApple).toHaveBeenCalledOnce();
});

it("deletes nothing when the Apple step is cancelled after confirming the sign-in", async () => {
	mocks.recentSignIn = false;
	mocks.appleReturnUrl = "https://foundry.appelent.nl/account";
	setup();
	fireEvent.click(button("Delete account"));
	fireEvent.click(dialog().getByRole("button", { name: "Delete account" }));
	await screen.findByText(/Next, Apple asks you to sign in/);
	fireEvent.click(dialog().getByRole("button", { name: "Cancel" }));
	await waitFor(() => expect(button("Delete account").disabled).toBe(false));
	expect(mocks.revokeApple).not.toHaveBeenCalled();
	expect(mocks.deleteData).not.toHaveBeenCalled();
});
