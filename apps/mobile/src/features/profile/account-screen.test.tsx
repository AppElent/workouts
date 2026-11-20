import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useConvex, useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import {
	clearSignedOutNotice,
	signedOutNotice,
} from "../../auth/signed-out-notice";
import { registerAccountStore } from "../../local-store/local-store";
import { reportError } from "../../observability/errors";
import { renderScreen } from "../../test-support/render-screen";
import { AccountDataMaintenanceProvider } from "../local-data/account-data-maintenance-provider";
import { AccountScreen } from "./account-screen";

const mockUser = {
	id: "test-user",
	firstName: "Alex",
	lastName: "Athlete",
	fullName: "Alex Athlete",
	username: null,
	hasImage: false,
	imageUrl: "",
	passwordEnabled: true,
	externalAccounts: [] as { provider: string; providerUserId: string }[],
	primaryEmailAddress: { emailAddress: "alex@example.test" },
	emailAddresses: [{ id: "e1", emailAddress: "alex@example.test" }],
	deleteSelfEnabled: true,
	update: jest.fn().mockResolvedValue(undefined),
	delete: jest.fn().mockResolvedValue(undefined),
	setProfileImage: jest.fn().mockResolvedValue(undefined),
};
const mockSignOut = jest.fn();
const mockSession = {
	reload: jest.fn(),
	checkAuthorization: jest.fn(),
};
let mockUserLoaded = true;
const mockCurrentUser = () => (mockUserLoaded ? mockUser : undefined);
jest.mock("@clerk/expo", () => ({
	useAuth: () => ({
		userId: "test-user",
		sessionId: "s1",
		isSignedIn: true,
		signOut: mockSignOut,
	}),
	useUser: () => ({ user: mockCurrentUser() }),
	useClerk: () => ({ session: mockSession }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock("expo-apple-authentication", () => ({ signInAsync: jest.fn() }));
jest.mock("expo-constants", () => ({
	__esModule: true,
	default: {
		expoConfig: { ios: { bundleIdentifier: "com.appelent.foundry.preview" } },
	},
}));
jest.mock("../../observability/errors", () => ({ reportError: jest.fn() }));

const deviceData = jest.fn();
registerAccountStore({ name: "account-screen-test", clear: deviceData });

const deleteData = jest.fn();
const action = jest.fn();
let blocker: "activeActivity" | null = null;
const originalOS = Platform.OS;

afterEach(() => {
	Platform.OS = originalOS;
	mockUserLoaded = true;
	mockUser.externalAccounts = [];
	mockUser.passwordEnabled = true;
});

beforeEach(() => {
	jest.clearAllMocks();
	clearSignedOutNotice();
	mockSignOut.mockResolvedValue(undefined);
	mockSession.reload.mockResolvedValue(undefined);
	mockSession.checkAuthorization.mockReturnValue(true);
	blocker = null;
	action.mockResolvedValue(null);
	jest.mocked(useConvex).mockReturnValue({
		query: jest.fn().mockResolvedValue([]),
		action,
	} as unknown as ReturnType<typeof useConvex>);
	deleteData
		.mockResolvedValueOnce({ done: false })
		.mockResolvedValueOnce({ done: true });
	jest
		.mocked(useMutation)
		.mockImplementation(
			(reference) =>
				(getFunctionName(reference) === "account:deleteData"
					? deleteData
					: jest.fn()) as unknown as ReturnType<typeof useMutation>,
		);
	jest
		.mocked(useQuery)
		.mockImplementation((...[reference]) =>
			getFunctionName(reference) === "account:deletionBlocker"
				? blocker
				: undefined,
		);
});

const renderAccount = async () =>
	await renderScreen(
		<AccountDataMaintenanceProvider>
			<AccountScreen />
		</AccountDataMaintenanceProvider>,
	);

async function confirmAction(label: string) {
	await fireEvent.press(screen.getByRole("button", { name: label }));
	await screen.findByText(/This cannot be undone/);
	const buttons = screen.getAllByRole("button", { name: label });
	expect(buttons).toHaveLength(2);
	await fireEvent.press(buttons[1]);
}

it("saves an edited name through Clerk", async () => {
	await renderAccount();
	await fireEvent.changeText(screen.getByLabelText("First name"), " Sam ");
	await fireEvent.press(screen.getByRole("button", { name: "Save name" }));
	await waitFor(() =>
		expect(mockUser.update).toHaveBeenCalledWith({
			firstName: "Sam",
			lastName: "Athlete",
		}),
	);
	expect(await screen.findByText("Name saved.")).toBeTruthy();
});

describe("the Change password row", () => {
	it("opens the Change password screen for an account with a password", async () => {
		await renderAccount();
		await fireEvent.press(
			screen.getByRole("button", { name: "Change password" }),
		);
		expect(mockPush).toHaveBeenCalledWith("/change-password");
	});

	it("is absent for an account without a password", async () => {
		mockUser.passwordEnabled = false;
		await renderAccount();
		expect(
			screen.queryByRole("button", { name: "Change password" }),
		).toBeNull();
	});
});

it("offers Foundry data only first, and names every app the whole account covers", async () => {
	await renderAccount();
	const [first, second] = screen.getAllByRole("button", {
		name: /^Delete (Foundry data only|my whole AppElent account)$/,
	});
	expect(first).toBe(
		screen.getByRole("button", { name: "Delete Foundry data only" }),
	);
	expect(second).toBe(
		screen.getByRole("button", { name: "Delete my whole AppElent account" }),
	);
	expect(
		screen.getByText(/Gather, Foundry, Fairway and Arcade Club/),
	).toBeTruthy();
});

it("deletes Foundry data in batches and this device's data, keeps the login, then signs out", async () => {
	await renderAccount();
	expect(screen.getAllByText(/Export your data first/)).toHaveLength(2);
	await confirmAction("Delete Foundry data only");
	await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
	// Signing out unmounts the toasts; the sign-in screen confirms instead.
	expect(signedOutNotice()).toBe("dataDeleted");
	expect(deleteData).toHaveBeenCalledTimes(2);
	expect(deleteData).toHaveBeenCalledWith({ expectedSubject: "test-user" });
	expect(deviceData).toHaveBeenCalledWith("test-user");
	expect(mockSignOut).toHaveBeenCalledTimes(1);
	expect(deviceData.mock.invocationCallOrder[0]).toBeLessThan(
		mockSignOut.mock.invocationCallOrder[0],
	);
	// The shared AppElent login is untouched.
	expect(mockUser.delete).not.toHaveBeenCalled();
});

it("says so when signing out fails after the Foundry data is gone", async () => {
	mockSignOut.mockRejectedValue(new Error("network"));
	await renderAccount();
	await confirmAction("Delete Foundry data only");
	expect(
		await screen.findByText(
			"Your Foundry data was deleted, but you could not be signed out. Sign out from Profile.",
		),
	).toBeTruthy();
	// Still signed in: no confirmation waits on the sign-in screen.
	expect(signedOutNotice()).toBeNull();
	expect(mockUser.delete).not.toHaveBeenCalled();
});

it("deletes the Clerk account only after the data is gone", async () => {
	await renderAccount();
	await confirmAction("Delete my whole AppElent account");
	await waitFor(() => expect(mockUser.delete).toHaveBeenCalled());
	expect(signedOutNotice()).toEqual({
		kind: "accountDeleted",
		apple: "notLinked",
	});
	expect(mockSignOut).not.toHaveBeenCalled();
	expect(deleteData).toHaveBeenCalledTimes(2);
	expect(deleteData.mock.invocationCallOrder[1]).toBeLessThan(
		mockUser.delete.mock.invocationCallOrder[0],
	);
});

it("keeps the user signed in with no confirmation when deleting the login fails", async () => {
	mockUser.delete.mockRejectedValueOnce(new Error("network"));
	await renderAccount();
	await confirmAction("Delete my whole AppElent account");
	expect(
		await screen.findByText(
			"Your data was deleted, but the account could not be deleted. Try Delete my whole AppElent account again.",
		),
	).toBeTruthy();
	expect(signedOutNotice()).toBeNull();
});

it("leaves no confirmation when there is no Clerk user to delete", async () => {
	await renderAccount();
	mockUserLoaded = false;
	await confirmAction("Delete my whole AppElent account");
	expect(
		await screen.findByText(
			"Your data was deleted, but the account could not be deleted. Try Delete my whole AppElent account again.",
		),
	).toBeTruthy();
	expect(signedOutNotice()).toBeNull();
});

describe("the recent sign-in Clerk needs to delete the account", () => {
	it("checks a freshly reloaded sign-in before deleting anything", async () => {
		await renderAccount();
		await confirmAction("Delete my whole AppElent account");
		await waitFor(() => expect(mockUser.delete).toHaveBeenCalled());
		expect(mockSession.checkAuthorization).toHaveBeenCalledWith({
			reverification: { level: "second_factor", afterMinutes: 5 },
		});
		expect(mockSession.reload.mock.invocationCallOrder[0]).toBeLessThan(
			mockSession.checkAuthorization.mock.invocationCallOrder[0],
		);
		expect(
			mockSession.checkAuthorization.mock.invocationCallOrder[0],
		).toBeLessThan(deleteData.mock.invocationCallOrder[0]);
	});

	it("deletes nothing and offers to sign in again when the sign-in is old", async () => {
		mockSession.checkAuthorization.mockReturnValue(false);
		await renderAccount();
		await confirmAction("Delete my whole AppElent account");
		expect(
			await screen.findByText(
				"Deleting your account needs a recent sign-in. Nothing was deleted. Sign in again, then choose Delete my whole AppElent account.",
			),
		).toBeTruthy();
		expect(deleteData).not.toHaveBeenCalled();
		expect(mockUser.delete).not.toHaveBeenCalled();
		expect(mockSignOut).not.toHaveBeenCalled();

		await fireEvent.press(
			screen.getByRole("button", { name: "Sign in again" }),
		);
		await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
		// The sign-in screen says to come back and delete again.
		expect(signedOutNotice()).toBe("signInToDelete");
		expect(deleteData).not.toHaveBeenCalled();
	});

	it("keeps the login and the notice off when signing out to sign in again fails", async () => {
		mockSession.checkAuthorization.mockReturnValue(false);
		mockSignOut.mockRejectedValue(new Error("network"));
		await renderAccount();
		await confirmAction("Delete my whole AppElent account");
		await fireEvent.press(
			await screen.findByRole("button", { name: "Sign in again" }),
		);
		expect(
			await screen.findByText("Could not sign out. Please try again."),
		).toBeTruthy();
		expect(signedOutNotice()).toBeNull();
	});

	it("does not check the sign-in for Foundry data only, which keeps the login", async () => {
		mockSession.checkAuthorization.mockReturnValue(false);
		await renderAccount();
		await confirmAction("Delete Foundry data only");
		await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
		expect(mockSession.checkAuthorization).not.toHaveBeenCalled();
		expect(deleteData).toHaveBeenCalled();
	});

	it("deletes nothing when the sign-in cannot be checked", async () => {
		mockSession.reload.mockRejectedValue(new Error("offline"));
		await renderAccount();
		await confirmAction("Delete my whole AppElent account");
		expect(
			await screen.findByText(
				"Your sign-in could not be checked. Nothing was deleted. Reconnect and try again.",
			),
		).toBeTruthy();
		expect(deleteData).not.toHaveBeenCalled();
		expect(screen.queryByRole("button", { name: "Sign in again" })).toBeNull();
	});

	it("says to sign in again to finish when Clerk still refuses after the data is gone", async () => {
		mockUser.delete.mockRejectedValueOnce({
			errors: [{ code: "session_reverification_required" }],
		});
		await renderAccount();
		await confirmAction("Delete my whole AppElent account");
		expect(
			await screen.findByText(
				"Your data was deleted, but the account was not, because your sign-in is no longer recent. Sign out, sign in again and choose Delete my whole AppElent account to finish.",
			),
		).toBeTruthy();
		expect(signedOutNotice()).toBeNull();
	});
});

describe("an account that signs in with Apple on iOS", () => {
	beforeEach(() => {
		Platform.OS = "ios";
		mockUser.externalAccounts = [
			{ provider: "apple", providerUserId: "apple-alex" },
		];
	});

	it("revokes the Apple grant before deleting anything", async () => {
		jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
			user: "apple-alex",
			authorizationCode: "apple-code",
		} as AppleAuthentication.AppleAuthenticationCredential);
		await renderAccount();
		await confirmAction("Delete my whole AppElent account");
		await waitFor(() => expect(mockUser.delete).toHaveBeenCalled());
		expect(signedOutNotice()).toEqual({
			kind: "accountDeleted",
			apple: "revoked",
		});
		expect(getFunctionName(action.mock.calls[0][0])).toBe(
			"account:revokeAppleSignIn",
		);
		expect(action.mock.calls[0][1]).toEqual({
			authorizationCode: "apple-code",
			bundleId: "com.appelent.foundry.preview",
		});
		expect(action.mock.invocationCallOrder[0]).toBeLessThan(
			deleteData.mock.invocationCallOrder[0],
		);
		expect(mockUser.delete).toHaveBeenCalled();
	});

	it("keeps the account when the Apple sheet is dismissed", async () => {
		jest
			.mocked(AppleAuthentication.signInAsync)
			.mockRejectedValue(
				Object.assign(new Error("canceled"), { code: "ERR_REQUEST_CANCELED" }),
			);
		await renderAccount();
		await confirmAction("Delete my whole AppElent account");
		await waitFor(() =>
			expect(AppleAuthentication.signInAsync).toHaveBeenCalled(),
		);
		expect(action).not.toHaveBeenCalled();
		expect(deleteData).not.toHaveBeenCalled();
		expect(mockUser.delete).not.toHaveBeenCalled();
	});

	it("still deletes the account when revoking fails", async () => {
		jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
			user: "apple-alex",
			authorizationCode: "apple-code",
		} as AppleAuthentication.AppleAuthenticationCredential);
		action.mockRejectedValue(new Error("failed"));
		await renderAccount();
		await confirmAction("Delete my whole AppElent account");
		await waitFor(() => expect(mockUser.delete).toHaveBeenCalled());
		expect(signedOutNotice()).toEqual({
			kind: "accountDeleted",
			apple: "notRevoked",
		});
		expect(reportError).toHaveBeenCalledWith(
			expect.any(Error),
			"account.revokeAppleSignIn",
		);
		expect(mockUser.delete).toHaveBeenCalled();
	});

	it("never revokes a different Apple Account's grant", async () => {
		jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
			user: "apple-someone-else",
			authorizationCode: "other-code",
		} as AppleAuthentication.AppleAuthenticationCredential);
		await renderAccount();
		await confirmAction("Delete my whole AppElent account");
		await waitFor(() => expect(mockUser.delete).toHaveBeenCalled());
		expect(signedOutNotice()).toEqual({
			kind: "accountDeleted",
			apple: "notRevoked",
		});
		expect(action).not.toHaveBeenCalled();
		expect(reportError).toHaveBeenCalledWith(
			expect.any(Error),
			"account.revokeAppleSignIn",
		);
		expect(mockUser.delete).toHaveBeenCalled();
	});

	it("checks the sign-in again after the Apple sheet, before deleting", async () => {
		jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
			user: "apple-alex",
			authorizationCode: "apple-code",
		} as AppleAuthentication.AppleAuthenticationCredential);
		mockSession.checkAuthorization
			.mockReturnValueOnce(true)
			.mockReturnValueOnce(false);
		await renderAccount();
		await confirmAction("Delete my whole AppElent account");
		expect(
			await screen.findByRole("button", { name: "Sign in again" }),
		).toBeTruthy();
		expect(mockSession.checkAuthorization).toHaveBeenCalledTimes(2);
		expect(deleteData).not.toHaveBeenCalled();
		expect(mockUser.delete).not.toHaveBeenCalled();
	});

	it("never opens the Apple sheet when the sign-in is old", async () => {
		mockSession.checkAuthorization.mockReturnValue(false);
		await renderAccount();
		await confirmAction("Delete my whole AppElent account");
		await screen.findByRole("button", { name: "Sign in again" });
		expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled();
	});

	it("tells the person the grant was not revoked on Android", async () => {
		Platform.OS = "android";
		await renderAccount();
		await confirmAction("Delete my whole AppElent account");
		await waitFor(() => expect(mockUser.delete).toHaveBeenCalled());
		expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled();
		expect(signedOutNotice()).toEqual({
			kind: "accountDeleted",
			apple: "notRevoked",
		});
	});

	it("does not ask Apple when only the data is deleted", async () => {
		await renderAccount();
		await confirmAction("Delete Foundry data only");
		await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
		expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled();
	});
});

it("explains and disables deletion while an Activity is running", async () => {
	blocker = "activeActivity";
	await renderAccount();
	expect(
		screen.getByText(
			"Finish or cancel the running Activity before deleting your data.",
		),
	).toBeTruthy();
	await fireEvent.press(
		screen.getByRole("button", { name: "Delete Foundry data only" }),
	);
	expect(
		screen.queryAllByRole("button", { name: "Delete Foundry data only" }),
	).toHaveLength(1);
	expect(deleteData).not.toHaveBeenCalled();
});
