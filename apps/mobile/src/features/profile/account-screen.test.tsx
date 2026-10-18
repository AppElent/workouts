import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useConvex, useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import { clearNutritionLocalAccount } from "../../data/nutrition-local-repository";
import { reportError } from "../../observability/errors";
import { renderScreen } from "../../test-support/render-screen";
import { AccountDataMaintenanceProvider } from "../local-data/account-data-maintenance-provider";
import { clearAccountSetDrafts } from "../strength-session/data/set-drafts";
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
	externalAccounts: [] as { provider: string }[],
	primaryEmailAddress: { emailAddress: "alex@example.test" },
	emailAddresses: [{ id: "e1", emailAddress: "alex@example.test" }],
	deleteSelfEnabled: true,
	update: jest.fn().mockResolvedValue(undefined),
	delete: jest.fn().mockResolvedValue(undefined),
	setProfileImage: jest.fn().mockResolvedValue(undefined),
};
jest.mock("@clerk/expo", () => ({
	useAuth: () => ({ userId: "test-user", sessionId: "s1", isSignedIn: true }),
	useUser: () => ({ user: mockUser }),
}));

jest.mock("expo-apple-authentication", () => ({ signInAsync: jest.fn() }));
jest.mock("../../observability/errors", () => ({ reportError: jest.fn() }));

jest.mock("../../data/nutrition-account-cleanup", () => ({
	clearNutritionAccountCache: jest.fn(),
	retireLegacyNutritionData: jest.fn(),
}));
jest.mock("../../data/nutrition-local-repository", () => ({
	clearNutritionLocalAccount: jest.fn(),
}));
jest.mock("../../data/personal-food-session", () => ({
	discardPersonalFoodSources: jest.fn(),
}));
jest.mock("../strength-session/data/set-drafts", () => ({
	clearAccountSetDrafts: jest.fn(),
}));

const deleteData = jest.fn();
const action = jest.fn();
let blocker: "activeActivity" | null = null;
const originalOS = Platform.OS;

afterEach(() => {
	Platform.OS = originalOS;
	mockUser.externalAccounts = [];
});

beforeEach(() => {
	jest.clearAllMocks();
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

it("deletes all data in batches after confirmation and keeps the account", async () => {
	await renderAccount();
	expect(screen.getAllByText(/Export your data first/)).toHaveLength(2);
	await confirmAction("Delete my data");
	expect(await screen.findByText("Your data was deleted.")).toBeTruthy();
	expect(deleteData).toHaveBeenCalledTimes(2);
	expect(deleteData).toHaveBeenCalledWith({ expectedSubject: "test-user" });
	expect(mockUser.delete).not.toHaveBeenCalled();
	expect(clearNutritionLocalAccount).toHaveBeenCalledWith("test-user");
	expect(clearAccountSetDrafts).toHaveBeenCalledWith("test-user");
});

it("deletes the Clerk account only after the data is gone", async () => {
	await renderAccount();
	await confirmAction("Delete account");
	expect(await screen.findByText("Your data was deleted.")).toBeTruthy();
	expect(mockUser.delete).toHaveBeenCalled();
	expect(deleteData).toHaveBeenCalledTimes(2);
	expect(deleteData.mock.invocationCallOrder[1]).toBeLessThan(
		mockUser.delete.mock.invocationCallOrder[0],
	);
});

describe("an account that signs in with Apple on iOS", () => {
	beforeEach(() => {
		Platform.OS = "ios";
		mockUser.externalAccounts = [{ provider: "apple" }];
	});

	it("revokes the Apple grant before deleting anything", async () => {
		jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
			authorizationCode: "apple-code",
		} as AppleAuthentication.AppleAuthenticationCredential);
		await renderAccount();
		await confirmAction("Delete account");
		expect(await screen.findByText("Your data was deleted.")).toBeTruthy();
		expect(getFunctionName(action.mock.calls[0][0])).toBe(
			"account:revokeAppleSignIn",
		);
		expect(action.mock.calls[0][1]).toEqual({
			authorizationCode: "apple-code",
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
		await confirmAction("Delete account");
		await waitFor(() =>
			expect(AppleAuthentication.signInAsync).toHaveBeenCalled(),
		);
		expect(action).not.toHaveBeenCalled();
		expect(deleteData).not.toHaveBeenCalled();
		expect(mockUser.delete).not.toHaveBeenCalled();
	});

	it("still deletes the account when revoking fails", async () => {
		jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
			authorizationCode: "apple-code",
		} as AppleAuthentication.AppleAuthenticationCredential);
		action.mockRejectedValue(new Error("failed"));
		await renderAccount();
		await confirmAction("Delete account");
		expect(await screen.findByText("Your data was deleted.")).toBeTruthy();
		expect(reportError).toHaveBeenCalledWith(
			expect.any(Error),
			"account.revokeAppleSignIn",
		);
		expect(mockUser.delete).toHaveBeenCalled();
	});

	it("does not ask Apple when only the data is deleted", async () => {
		await renderAccount();
		await confirmAction("Delete my data");
		expect(await screen.findByText("Your data was deleted.")).toBeTruthy();
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
	await fireEvent.press(screen.getByRole("button", { name: "Delete my data" }));
	expect(
		screen.queryAllByRole("button", { name: "Delete my data" }),
	).toHaveLength(1);
	expect(deleteData).not.toHaveBeenCalled();
});
