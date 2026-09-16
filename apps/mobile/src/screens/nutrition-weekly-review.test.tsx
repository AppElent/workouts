import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import { NutritionWeeklyReviewScreen } from "./nutrition-weekly-review";

const mockUseQuery = jest.fn();
const mockToggleComplete = jest.fn();
const mockToastError = jest.fn();
const mockGetOperations = jest.fn();
const mockListDraftsForDate = jest.fn();
const mockConfirm = jest.fn();

jest.mock("convex/react", () => ({
	useConvexConnectionState: () => ({ isWebSocketConnected: true }),
	useMutation: () => mockToggleComplete,
	useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
jest.mock("../convex/api", () => ({
	api: {
		nutritionReview: {
			week: "nutritionReview:week",
			toggleComplete: "nutritionReview:toggleComplete",
		},
	},
}));
jest.mock("../data/nutrition-operation-service", () => ({
	useNutritionOperations: () => ({
		getSubject: () => "test-user",
		getOperations: mockGetOperations,
	}),
	useNutritionOperationVersion: () => 0,
}));
jest.mock("../data/nutrition-drafts", () => ({
	useNutritionDrafts: () => ({
		revision: 0,
		listForDate: mockListDraftsForDate,
	}),
}));
jest.mock("../ui/confirm-dialog", () => ({
	useConfirm: () => mockConfirm,
}));
jest.mock("../i18n", () => ({
	fmt: jest.requireActual("@appelent/i18n/core").fmt,
	useI18n: () => ({
		locale: "en",
		t: jest.requireActual("../i18n/messages/en").en,
	}),
}));
jest.mock("../ui/toast", () => ({
	useToast: () => ({ error: mockToastError }),
}));

const total = (amount: number, qualified = false) => ({
	amount,
	entryCount: 1,
	valueCount: 1,
	traceCount: qualified ? 1 : 0,
	absentCount: 0,
	incomplete: false,
	qualified,
});

const emptyTotal = () => ({
	amount: 0,
	entryCount: 0,
	valueCount: 0,
	traceCount: 0,
	absentCount: 0,
	incomplete: false,
	qualified: false,
});

function reviewWithMissingDay() {
	const totals = {
		energy: total(100, true),
		protein: total(5),
		carbs: total(20),
		fat: total(2),
		saturatedFat: total(1),
		fibre: total(3),
		sugars: total(4),
		salt: total(0.1),
	};
	const emptyTotals = {
		energy: emptyTotal(),
		protein: emptyTotal(),
		carbs: emptyTotal(),
		fat: emptyTotal(),
		saturatedFat: emptyTotal(),
		fibre: emptyTotal(),
		sugars: emptyTotal(),
		salt: emptyTotal(),
	};
	return {
		startDate: "2026-09-07",
		endDate: "2026-09-13",
		days: [
			{
				date: "2026-09-07",
				entries: [
					{
						name: { en: "Oatmeal", nl: "Havermout" },
						nutrients: { energy: { kind: "value", amount: 100 } },
					},
				],
				totals,
				markedComplete: false,
			},
			...Array.from({ length: 6 }, (_, index) => ({
				date: `2026-09-${String(8 + index).padStart(2, "0")}`,
				entries: [],
				totals: emptyTotals,
				markedComplete: false,
			})),
		],
		coverage: { loggedDayCount: 1, markedCompleteCount: 0 },
		averages: { energy: 100, protein: 5, energyDays: 1, proteinDays: 1 },
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	mockGetOperations.mockReturnValue([]);
	mockListDraftsForDate.mockReturnValue([]);
	mockConfirm.mockResolvedValue(true);
	mockUseQuery.mockReturnValue(reviewWithMissingDay());
	mockToggleComplete.mockResolvedValue({ date: "2026-09-07", completed: true });
});

describe("nutrition weekly review screen", () => {
	it("shows synced-only pending notice and unknown missing days", () => {
		mockGetOperations.mockReturnValue([{ status: "pending" }]);
		render(
			<NutritionWeeklyReviewScreen
				startDate="2026-09-07"
				onClose={jest.fn()}
			/>,
		);

		expect(
			screen.getByText(
				"Some saved meals are still waiting to sync; this review shows synced diary data only.",
			),
		).toBeTruthy();
		expect(screen.getAllByText("No entries; intake is unknown.")).toHaveLength(
			6,
		);
		expect(screen.getByText("Energy: 100 kcal · incomplete")).toBeTruthy();
		expect(
			screen.getByText("Missing days are unknown, not zero intake."),
		).toBeTruthy();
	});

	it("surfaces marker failures and keeps the review available", async () => {
		mockToggleComplete.mockRejectedValueOnce(new Error("marker failed"));
		render(
			<NutritionWeeklyReviewScreen
				startDate="2026-09-07"
				onClose={jest.fn()}
			/>,
		);

		fireEvent.press(screen.getAllByText("Mark complete")[0]);
		await waitFor(() =>
			expect(mockToastError).toHaveBeenCalledWith(
				"This day could not be updated. Try again.",
			),
		);
		expect(screen.getByText("Weekly review")).toBeTruthy();
	});

	it("counts a day's unresolved notes and asks before marking it complete", async () => {
		mockListDraftsForDate.mockImplementation((date: string) =>
			date === "2026-09-08"
				? [
						{ id: "d1", note: "Pizza" },
						{ id: "d2", note: "Beer" },
					]
				: [],
		);
		mockConfirm.mockResolvedValueOnce(false);
		render(
			<NutritionWeeklyReviewScreen
				startDate="2026-09-07"
				onClose={jest.fn()}
			/>,
		);

		expect(screen.getByText("2 notes")).toBeTruthy();
		// Day one has no notes: marking it complete asks nothing.
		fireEvent.press(screen.getAllByText("Mark complete")[0]);
		await waitFor(() => expect(mockToggleComplete).toHaveBeenCalledTimes(1));
		expect(mockConfirm).not.toHaveBeenCalled();

		// Day two has notes: it asks, and a "no" leaves the day alone.
		fireEvent.press(screen.getAllByText("Mark complete")[1]);
		await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
		expect(mockConfirm.mock.calls[0][0]).toMatchObject({
			title: "Mark complete with unresolved notes?",
			confirmLabel: "Mark complete",
		});
		expect(mockToggleComplete).toHaveBeenCalledTimes(1);
	});
});
