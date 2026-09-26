import { fireEvent, screen } from "@testing-library/react-native";
import { useMutation } from "convex/react";
import { renderThemed } from "../test-support/render-themed";
import { StartActivityScreen } from "./start-activity";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, replace: jest.fn() }),
	Stack: { Screen: () => null },
}));
jest.mock("../i18n", () => ({ useI18n: () => ({ locale: "en" }) }));
jest.mock("../ui/toast", () => ({ useToast: () => ({ error: jest.fn() }) }));

it("opens each endurance logger without creating an active strength session", () => {
	const createSession = jest.fn();
	jest.mocked(useMutation).mockReturnValue(createSession as never);
	renderThemed(<StartActivityScreen />);
	fireEvent.press(screen.getByRole("button", { name: "Log run" }));
	expect(mockPush).toHaveBeenLastCalledWith({
		pathname: "/endurance-editor",
		params: { sport: "running" },
	});
	fireEvent.press(screen.getByRole("button", { name: "Log ride" }));
	expect(mockPush).toHaveBeenLastCalledWith({
		pathname: "/endurance-editor",
		params: { sport: "cycling" },
	});
	expect(createSession).not.toHaveBeenCalled();
});
