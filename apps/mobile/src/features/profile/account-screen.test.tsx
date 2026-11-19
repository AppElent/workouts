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
	expect(signedOutNotice()).toBe("accountDeleted");
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
		expect(signedOutNotice()).toBe("accountDeleted");
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
		expect(signedOutNotice()).toBe("accountDeleted");
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
		expect(signedOutNotice()).toBe("accountDeleted");
		expect(action).not.toHaveBeenCalled();
		expect(reportError).toHaveBeenCalledWith(
			expect.any(Error),
			"account.revokeAppleSignIn",
		);
		expect(mockUser.delete).toHaveBeenCalled();
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
