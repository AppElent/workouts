import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { clearNutritionLocalAccount } from "../../data/nutrition-local-repository";
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
	externalAccounts: [],
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
let blocker: "activeActivity" | null = null;

beforeEach(() => {
	jest.clearAllMocks();
	blocker = null;
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
