import { screen } from "@testing-library/react-native";
import { useConvexAuth } from "convex/react";
import { Text } from "react-native";
import { renderThemed as render } from "../test-support/render-themed";
import { ConvexSessionGate } from "./convex-session-gate";

jest.mock("convex/react", () => ({ useConvexAuth: jest.fn() }));

const convexAuth = useConvexAuth as unknown as jest.Mock;

/**
 * The window this closes: Clerk says signed in, Convex has not finished the
 * handshake, and anything that queries throws `Unauthenticated` out of render.
 */
function Child() {
	if (!convexAuth().isAuthenticated) {
		throw new Error("Unauthenticated");
	}
	return <Text>Signed-in shell</Text>;
}

it("withholds the subtree while the Convex handshake is still in flight", () => {
	convexAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
	render(
		<ConvexSessionGate>
			<Child />
		</ConvexSessionGate>,
	);
	expect(screen.queryByText("Signed-in shell")).toBeNull();
});

it("renders the subtree once Convex reports the session as authenticated", () => {
	convexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
	render(
		<ConvexSessionGate>
			<Child />
		</ConvexSessionGate>,
	);
	expect(screen.getByText("Signed-in shell")).toBeTruthy();
});
