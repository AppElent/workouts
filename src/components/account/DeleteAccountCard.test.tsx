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
}));

vi.mock("convex/react", () => ({
	useQuery: () => mocks.blocker,
	useMutation: () => mocks.deleteData,
	useAction: () => mocks.revokeAction,
	useConvexConnectionState: () => ({ isWebSocketConnected: mocks.online }),
}));
vi.mock("@clerk/react", () => ({
	useAuth: () => ({ userId: "user_1" }),
	useUser: () => ({
		user: {
			deleteSelfEnabled: mocks.deleteSelfEnabled,
			externalAccounts: [],
			delete: mocks.deleteUser,
		},
	}),
}));
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));
vi.mock("#/lib/auth/appleRevocation", () => ({
	revokeAppleSignIn: mocks.revokeApple,
}));

beforeEach(() => {
	vi.clearAllMocks();
	mocks.blocker = null;
	mocks.online = true;
	mocks.deleteSelfEnabled = true;
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

it("stays disabled until the blocker is known, and while offline", () => {
	mocks.blocker = undefined;
	setup();
	expect(button("Delete my data").disabled).toBe(true);
	mocks.blocker = null;
	mocks.online = false;
	setup();
	expect(screen.getByText("Connect to delete your data.")).toBeTruthy();
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
