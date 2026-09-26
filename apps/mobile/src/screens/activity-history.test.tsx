import { fireEvent, screen } from "@testing-library/react-native";
import { useActivityPages } from "../data/activity-data";
import { renderThemed } from "../test-support/render-themed";
import { ActivityHistoryScreen } from "./activity-history";
import { EnduranceProgress } from "./endurance-progress";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
	useLocalSearchParams: () => ({}),
	Stack: { Screen: () => null },
}));
jest.mock("../data/activity-data", () => ({ useActivityPages: jest.fn() }));
jest.mock("../i18n", () => ({ useI18n: () => ({ locale: "en" }) }));
jest.mock("../ui/chart", () => ({ BucketChart: () => null }));

const mockPages = jest.mocked(useActivityPages);
beforeEach(() => {
	mockPush.mockReset();
	mockPages.mockReturnValue({
		items: [],
		loading: false,
		hasMore: false,
		loadMore: jest.fn(),
	});
});

it("filters the history and opens the matching logger", () => {
	renderThemed(<ActivityHistoryScreen />);
	fireEvent.press(screen.getByRole("radio", { name: "Cycling" }));
	expect(mockPages).toHaveBeenLastCalledWith({ sport: "cycling" });
	fireEvent.press(screen.getByRole("button", { name: "Log ride" }));
	expect(mockPush).toHaveBeenCalledWith({
		pathname: "/endurance-editor",
		params: { sport: "cycling" },
	});
});

it("opens endurance details and keeps strength summary navigation", () => {
	mockPages.mockReturnValue({
		items: [
			{
				id: "run-id",
				sport: "running",
				occurredAt: 1,
				title: "Morning run",
				durationSeconds: 1500,
				distanceMeters: 5000,
			},
			{
				id: "strength-id",
				sport: "strength",
				occurredAt: 1,
				title: "Push day",
				durationSeconds: 1800,
			},
		],
		loading: false,
		hasMore: false,
		loadMore: jest.fn(),
	});
	renderThemed(<ActivityHistoryScreen />);
	fireEvent.press(screen.getByText("Morning run"));
	expect(mockPush).toHaveBeenLastCalledWith({
		pathname: "/endurance/[id]",
		params: { id: "run-id" },
	});
	fireEvent.press(screen.getByText("Push day"));
	expect(mockPush).toHaveBeenLastCalledWith({
		pathname: "/summary",
		params: { id: "strength-id" },
	});
});

it("derives running pace from totals rather than averaging individual paces", () => {
	const now = Date.now();
	mockPages.mockReturnValue({
		items: [
			{
				id: "a",
				sport: "running",
				occurredAt: now,
				durationSeconds: 600,
				distanceMeters: 1000,
			},
			{
				id: "b",
				sport: "running",
				occurredAt: now,
				durationSeconds: 1200,
				distanceMeters: 4000,
			},
		],
		loading: false,
		hasMore: false,
		loadMore: jest.fn(),
	});
	renderThemed(<EnduranceProgress sport="running" />);
	expect(screen.getByText("6:00 /km")).toBeTruthy();
	expect(screen.queryByText("6:30 /km")).toBeNull();
});
