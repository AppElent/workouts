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
	signOut: vi.fn(),
	deleteSelfEnabled: true,
	// Whether the session's sign-in is recent enough for Clerk.
	recentSignIn: true,
	// How the person answers Clerk's verify dialog.
	verifies: true,
	verifyPrompts: 0,
	// Whether completing the dialog makes the sign-in recent.
	verifyRefreshes: true,
	appleReturnUrl: null as string | null,
	// The live Clerk identity; another tab can switch it.
	clerkUserId: "user_1",
	// Reloading the session shows a sign-in older than the tab believed.
	staleAfterReload: false,
	// Another tab signs in to another account while the session reloads.
	switchOnReload: false,
	checkAuthorization: vi.fn(),
	forgetGuestKey: vi.fn(),
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
		get session() {
			return {
				id: "sess_1",
				checkAuthorization: mocks.checkAuthorization,
				reload: async () => {
					if (mocks.switchOnReload) mocks.clerkUserId = "user_2";
					if (mocks.staleAfterReload) {
						mocks.staleAfterReload = false;
						mocks.recentSignIn = false;
					}
				},
			};
		},
		get user() {
			return { id: mocks.clerkUserId, delete: mocks.deleteUser };
		},
		signOut: mocks.signOut,
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
vi.mock("#/components/hosted/guestKey", () => ({
	forgetGuestKey: mocks.forgetGuestKey,
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
	mocks.clerkUserId = "user_1";
	mocks.staleAfterReload = false;
	mocks.switchOnReload = false;
	mocks.checkAuthorization.mockImplementation(() => mocks.recentSignIn);
	mocks.deleteData.mockResolvedValue({ done: true });
	mocks.revokeApple.mockResolvedValue("notLinked");
	mocks.deleteUser.mockResolvedValue(undefined);
	mocks.signOut.mockResolvedValue(undefined);
});

const tree = () => (
	<LocaleProvider initialLocale="en">
		<ToastHost>
			<ConfirmDialogProvider>
				<DeleteAccountCard />
			</ConfirmDialogProvider>
		</ToastHost>
	</LocaleProvider>
);

const setup = () => render(tree());

const button = (name: string) =>
	screen.getByRole<HTMLButtonElement>("button", { name });
const dialog = () => within(screen.getByRole("alertdialog"));
const notifications = () =>
	within(screen.getByRole("region", { name: "Notifications" }));

it("disables both actions and explains why while deletion is blocked", () => {
	mocks.blocker = "activeActivity";
	setup();
	expect(button("Delete Foundry data only").disabled).toBe(true);
	expect(button("Delete my whole AppElent account").disabled).toBe(true);
	expect(screen.getByRole("status").textContent).toBe(
		"Finish or cancel the running Activity before deleting your data.",
	);
});

it("stays disabled until the blocker is known", () => {
	mocks.blocker = undefined;
	setup();
	expect(button("Delete Foundry data only").disabled).toBe(true);
	expect(button("Delete my whole AppElent account").disabled).toBe(true);
});

it("stays disabled offline and says why", () => {
	mocks.online = false;
	setup();
	expect(button("Delete Foundry data only").disabled).toBe(true);
	expect(button("Delete my whole AppElent account").disabled).toBe(true);
	expect(screen.getByRole("status").textContent).toBe(
		"Connect to delete your data.",
	);
});

it("offers no account deletion when the Clerk instance disables it", () => {
	mocks.deleteSelfEnabled = false;
	setup();
	expect(button("Delete Foundry data only").disabled).toBe(false);
	expect(button("Delete my whole AppElent account").disabled).toBe(true);
	expect(
		screen.getByText(/Deleting the AppElent account is turned off/),
	).toBeTruthy();
});

it("deletes nothing when the confirmation is cancelled", async () => {
	setup();
	fireEvent.click(button("Delete Foundry data only"));
	expect(dialog().getByText(/will be permanently removed/)).toBeTruthy();
	fireEvent.click(dialog().getByRole("button", { name: "Cancel" }));
	await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
	expect(mocks.deleteData).not.toHaveBeenCalled();
});

it("lists Foundry data only first and names every app the whole account covers", () => {
	setup();
	const [first, second] = screen.getAllByRole("button");
	expect(first.textContent).toBe("Delete Foundry data only");
	expect(second.textContent).toBe("Delete my whole AppElent account");
	expect(
		screen.getByText(/Gather, Foundry, Fairway and Arcade Club/),
	).toBeTruthy();
});

it("deletes Foundry data in batches, keeps the login, and signs out this session", async () => {
	mocks.appleReturnUrl = "https://foundry.example/apple";
	mocks.deleteData
		.mockResolvedValueOnce({ done: false })
		.mockResolvedValueOnce({ done: true });
	setup();
	fireEvent.click(button("Delete Foundry data only"));
	expect(dialog().getByText(/Your AppElent login stays/)).toBeTruthy();
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete Foundry data only" }),
	);
	await waitFor(() =>
		expect(mocks.signOut).toHaveBeenCalledWith({
			sessionId: "sess_1",
			redirectUrl: "/?deleted=data",
		}),
	);
	expect(mocks.deleteData).toHaveBeenCalledTimes(2);
	expect(mocks.deleteData).toHaveBeenCalledWith({ expectedSubject: "user_1" });
	// The shared AppElent login is untouched.
	expect(mocks.revokeApple).not.toHaveBeenCalled();
	expect(mocks.deleteUser).not.toHaveBeenCalled();
	expect(mocks.checkAuthorization).not.toHaveBeenCalled();
	// Leaves the signed-in pages before signing out.
	expect(mocks.navigate).toHaveBeenCalledWith({ to: "/", replace: true });
	expect(mocks.navigate.mock.invocationCallOrder[0]).toBeLessThan(
		mocks.signOut.mock.invocationCallOrder[0],
	);
});

it("says so when signing out fails after the Foundry data is gone", async () => {
	mocks.signOut.mockRejectedValue(new Error("network"));
	setup();
	fireEvent.click(button("Delete Foundry data only"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete Foundry data only" }),
	);
	expect(
		await notifications().findByText(
			"Your Foundry data was deleted, but you could not be signed out. Sign out from the menu.",
		),
	).toBeTruthy();
	expect(mocks.deleteUser).not.toHaveBeenCalled();
});

it("shows the server's refusal when deleting fails", async () => {
	mocks.deleteData.mockRejectedValue(
		new ConvexError({ code: "hostedWorkout" }),
	);
	setup();
	fireEvent.click(button("Delete Foundry data only"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete Foundry data only" }),
	);
	expect(
		await notifications().findByText(
			/involved in a Hosted Workout\. Deleting is unavailable/,
		),
	).toBeTruthy();
	expect(button("Delete Foundry data only").disabled).toBe(false);
});

it("says deleting stopped when a batch fails without a code", async () => {
	mocks.deleteData.mockRejectedValue(new Error("network"));
	setup();
	fireEvent.click(button("Delete Foundry data only"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete Foundry data only" }),
	);
	expect(
		await notifications().findByText(/Deleting stopped before it finished/),
	).toBeTruthy();
});

it("revokes Apple, deletes data, deletes the account, then leaves for the start", async () => {
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	expect(
		dialog().getByText(
			/Your AppElent login is deleted, and with it your data in Gather, Foundry, Fairway and Arcade Club/,
		),
	).toBeTruthy();
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await waitFor(() =>
		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/",
			search: { deleted: "account" },
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
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await waitFor(() => expect(mocks.revokeApple).toHaveBeenCalled());
	expect(mocks.deleteData).not.toHaveBeenCalled();
	expect(mocks.deleteUser).not.toHaveBeenCalled();
});

it("keeps the person here when Clerk refuses to delete the account", async () => {
	mocks.deleteUser.mockRejectedValue(new Error("forbidden"));
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	expect(
		await notifications().findByText(
			/the account could not be deleted\. Try Delete my whole AppElent account again/,
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
	fireEvent.click(button("Delete Foundry data only"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete Foundry data only" }),
	);
	await waitFor(() =>
		expect(button("Delete Foundry data only").disabled).toBe(true),
	);
	expect(button("Delete my whole AppElent account").disabled).toBe(true);
	fireEvent.click(button("Delete my whole AppElent account"));
	expect(screen.queryByRole("alertdialog")).toBeNull();
	finish({ done: true });
	await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
	expect(mocks.deleteData).toHaveBeenCalledTimes(1);
});

it("keeps the account when deleting its data fails", async () => {
	mocks.deleteData.mockRejectedValue(new Error("network"));
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await notifications().findByText(/Deleting stopped before it finished/);
	expect(mocks.deleteUser).not.toHaveBeenCalled();
	expect(mocks.navigate).not.toHaveBeenCalled();
});

it("stops and asks to allow pop-ups when the browser blocks the Apple window", async () => {
	mocks.revokeApple.mockResolvedValue("popupBlocked");
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await notifications().findByText(/Allow pop-ups for this site/);
	expect(mocks.deleteData).not.toHaveBeenCalled();
	expect(mocks.deleteUser).not.toHaveBeenCalled();
});

it("stops and says so when Apple signed in another Apple account", async () => {
	mocks.revokeApple.mockResolvedValue("appleMismatch");
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await notifications().findByText(/not the one linked to this account/);
	expect(mocks.deleteData).not.toHaveBeenCalled();
	expect(mocks.deleteUser).not.toHaveBeenCalled();
});

it("stops with the blocker message when an Activity starts before Apple revokes", async () => {
	mocks.revokeApple.mockResolvedValue("activeActivity");
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await notifications().findByText(
		/Finish or cancel the running Activity before deleting your data/,
	);
	expect(mocks.deleteData).not.toHaveBeenCalled();
	expect(mocks.deleteUser).not.toHaveBeenCalled();
	expect(mocks.navigate).not.toHaveBeenCalled();
});

it("asks to confirm an old sign-in before deleting anything, then deletes", async () => {
	mocks.recentSignIn = false;
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
	expect(mocks.verifyPrompts).toBe(1);
	expect(mocks.deleteUser).toHaveBeenCalledOnce();
});

it("deletes nothing when confirming the sign-in is cancelled", async () => {
	mocks.recentSignIn = false;
	mocks.verifies = false;
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await waitFor(() => expect(mocks.verifyPrompts).toBe(1));
	await waitFor(() =>
		expect(button("Delete my whole AppElent account").disabled).toBe(false),
	);
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
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	expect(
		await notifications().findByText(
			/Your data was deleted, but the account was not.*Choose Delete my whole AppElent account again and confirm your sign-in/,
		),
	).toBeTruthy();
	expect(mocks.deleteData).toHaveBeenCalled();
	expect(mocks.navigate).not.toHaveBeenCalled();
});

it("deletes nothing when the sign-in is still old after Clerk's dialog", async () => {
	mocks.recentSignIn = false;
	mocks.verifyRefreshes = false;
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
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
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	expect(
		await notifications().findByText(
			/Choose Delete my whole AppElent account again and confirm your sign-in/,
		),
	).toBeTruthy();
	expect(mocks.deleteUser).toHaveBeenCalledTimes(2);
	expect(mocks.navigate).not.toHaveBeenCalled();
});

it("asks for a fresh click before Apple's window after confirming the sign-in", async () => {
	mocks.recentSignIn = false;
	mocks.appleReturnUrl = "https://foundry.appelent.nl/account";
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	expect(
		await screen.findByText(/Next, Apple asks you to sign in/),
	).toBeTruthy();
	expect(mocks.revokeApple).not.toHaveBeenCalled();
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
	expect(mocks.revokeApple).toHaveBeenCalledOnce();
});

it("deletes nothing when the Apple step is cancelled after confirming the sign-in", async () => {
	mocks.recentSignIn = false;
	mocks.appleReturnUrl = "https://foundry.appelent.nl/account";
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await screen.findByText(/Next, Apple asks you to sign in/);
	fireEvent.click(dialog().getByRole("button", { name: "Cancel" }));
	await waitFor(() =>
		expect(button("Delete my whole AppElent account").disabled).toBe(false),
	);
	expect(mocks.revokeApple).not.toHaveBeenCalled();
	expect(mocks.deleteData).not.toHaveBeenCalled();
});

it("never deletes another account signed in while the data was being deleted", async () => {
	let finish = (_: { done: boolean }) => {};
	mocks.deleteData.mockReturnValue(
		new Promise((resolve) => {
			finish = resolve;
		}),
	);
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await waitFor(() => expect(mocks.deleteData).toHaveBeenCalled());
	mocks.clerkUserId = "user_2";
	finish({ done: true });
	expect(
		await notifications().findByText(/signed in to a different account now/),
	).toBeTruthy();
	expect(mocks.deleteUser).not.toHaveBeenCalled();
	expect(mocks.navigate).not.toHaveBeenCalled();
});

it("stops before Apple when a blocker appears while the dialogs are open", async () => {
	mocks.recentSignIn = false;
	mocks.appleReturnUrl = "https://foundry.appelent.nl/account";
	const view = setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await screen.findByText(/Next, Apple asks you to sign in/);
	mocks.blocker = "activeActivity";
	view.rerender(tree());
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await notifications().findByText(/Finish or cancel the running Activity/);
	expect(mocks.revokeApple).not.toHaveBeenCalled();
	expect(mocks.deleteData).not.toHaveBeenCalled();
});

it("reloads the session before trusting its sign-in age", async () => {
	mocks.staleAfterReload = true;
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
	expect(mocks.verifyPrompts).toBe(1);
});

it("asks for a click before Apple's window even when the sign-in is recent", async () => {
	mocks.appleReturnUrl = "https://foundry.appelent.nl/account";
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await screen.findByText(/Next, Apple asks you to sign in/);
	expect(mocks.verifyPrompts).toBe(0);
	expect(mocks.revokeApple).not.toHaveBeenCalled();
});

it("points the disabled buttons at the explanation", () => {
	mocks.blocker = "activeActivity";
	setup();
	const id = screen.getByRole("status").id;
	expect(
		button("Delete Foundry data only").getAttribute("aria-describedby"),
	).toBe(id);
	expect(
		button("Delete my whole AppElent account").getAttribute("aria-describedby"),
	).toBe(id);
});

it("checks the sign-in again after Apple's step and deletes nothing when that is cancelled", async () => {
	mocks.appleReturnUrl = "https://foundry.appelent.nl/account";
	mocks.revokeApple.mockImplementation(async () => {
		// The 10-minute window runs out while Apple's window is open.
		mocks.recentSignIn = false;
		mocks.verifies = false;
		return "revoked";
	});
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await screen.findByText(/Next, Apple asks you to sign in/);
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await waitFor(() => expect(mocks.verifyPrompts).toBe(1));
	await waitFor(() =>
		expect(button("Delete my whole AppElent account").disabled).toBe(false),
	);
	expect(mocks.revokeApple).toHaveBeenCalledOnce();
	expect(mocks.deleteData).not.toHaveBeenCalled();
	expect(mocks.deleteUser).not.toHaveBeenCalled();
});

it("says the sign-in failed after Apple's step when the sign-in stays old", async () => {
	mocks.appleReturnUrl = "https://foundry.appelent.nl/account";
	mocks.verifyRefreshes = false;
	mocks.revokeApple.mockImplementation(async () => {
		mocks.recentSignIn = false;
		return "revoked";
	});
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await screen.findByText(/Next, Apple asks you to sign in/);
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	expect(
		await notifications().findByText(
			/After the Apple step, your sign-in could not be confirmed/,
		),
	).toBeTruthy();
	expect(mocks.deleteData).not.toHaveBeenCalled();
});

it("stops without Clerk's dialog when another account signs in during the reload", async () => {
	mocks.switchOnReload = true;
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	expect(
		await notifications().findByText(/signed in to a different account now/),
	).toBeTruthy();
	expect(mocks.verifyPrompts).toBe(0);
	expect(mocks.deleteData).not.toHaveBeenCalled();
});

it("asks for a sign-in within half of Clerk's window, so it can't lapse mid-deletion", async () => {
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
	expect(mocks.checkAuthorization).toHaveBeenCalledWith({
		reverification: { level: "second_factor", afterMinutes: 5 },
	});
});

it.each([
	["revoked", "accountAppleRevoked"],
	["notRevoked", "accountAppleNotRevoked"],
] as const)(
	"lands on the start saying how Apple ended (%s)",
	async (apple, deleted) => {
		mocks.revokeApple.mockResolvedValue(apple);
		setup();
		fireEvent.click(button("Delete my whole AppElent account"));
		fireEvent.click(
			dialog().getByRole("button", {
				name: "Delete my whole AppElent account",
			}),
		);
		await waitFor(() =>
			expect(mocks.navigate).toHaveBeenCalledWith(
				expect.objectContaining({ search: { deleted } }),
			),
		);
	},
);

it("forgets this browser's guest key once the account is deleted", async () => {
	setup();
	fireEvent.click(button("Delete my whole AppElent account"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
	expect(mocks.forgetGuestKey).toHaveBeenCalledOnce();
	expect(mocks.deleteUser.mock.invocationCallOrder[0]).toBeLessThan(
		mocks.forgetGuestKey.mock.invocationCallOrder[0],
	);
});

it("keeps the guest key when only the Foundry data is deleted", async () => {
	setup();
	fireEvent.click(button("Delete Foundry data only"));
	fireEvent.click(
		dialog().getByRole("button", { name: "Delete Foundry data only" }),
	);
	await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
	expect(mocks.forgetGuestKey).not.toHaveBeenCalled();
});
