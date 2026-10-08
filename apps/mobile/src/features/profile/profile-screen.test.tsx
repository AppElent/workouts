import { fireEvent, screen } from "expo-router/testing-library";
import { renderApp } from "../../test-support/render-app";

const mockSignOut = jest.fn();
jest.mock("@clerk/expo", () => ({
	useAuth: () => ({
		userId: "test-user",
		isLoaded: true,
		isSignedIn: true,
		signOut: mockSignOut,
	}),
	useUser: () => ({
		user: {
			fullName: "Alex Athlete",
			primaryEmailAddress: { emailAddress: "alex@example.test" },
			imageUrl: null,
		},
	}),
}));

it("shows the signed-in identity and unavailable totals, and always confirms sign-out", async () => {
	renderApp("/profile");
	expect(await screen.findByText("Alex Athlete")).toBeTruthy();
	expect(screen.getByText("alex@example.test")).toBeTruthy();
	expect(screen.queryByText("142")).toBeNull();
	expect(screen.getAllByText("—")).toHaveLength(3);
	fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
	expect(await screen.findByText("Sign out?")).toBeTruthy();
	expect(mockSignOut).not.toHaveBeenCalled();
	fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
	expect(mockSignOut).not.toHaveBeenCalled();
});
