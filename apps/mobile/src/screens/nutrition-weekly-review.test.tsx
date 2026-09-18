import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { OFFLINE_GRACE_MS } from "../data/stalled-offline";
import { NutritionWeeklyReviewScreen } from "./nutrition-weekly-review";

const mockUseQuery = jest.fn();
const mockGetOperations = jest.fn();
let mockConnected = true;

jest.mock("convex/react", () => ({
	useConvexConnectionState: () => ({ isWebSocketConnected: mockConnected }),
	useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
jest.mock("../convex/api", () => ({
	api: { nutritionReview: { week: "nutritionReview:week" } },
}));
jest.mock("../data/nutrition-operation-service", () => ({
	useNutritionOperations: () => ({
		getSubject: () => "test-user",
		getOperations: mockGetOperations,
	}),
	useNutritionOperationVersion: () => 0,
}));
jest.mock("../data/nutrition-drafts", () => ({
	useNutritionDrafts: () => ({ listForDate: () => [] }),
}));
jest.mock("../i18n", () => {
	const actual = jest.requireActual("../i18n");
	const { en } = jest.requireActual("../i18n/messages/en");
	return {
		...actual,
		useI18n: () => ({ locale: "en", t: en }),
	};
});

const total = (
	amount: number,
	options: { incomplete?: boolean; qualified?: boolean } = {},
) => ({
	amount,
	entryCount: 1,
	valueCount: 1,
	traceCount: options.qualified ? 1 : 0,
	absentCount: options.incomplete ? 1 : 0,
	incomplete: options.incomplete ?? false,
	qualified: options.qualified ?? options.incomplete ?? false,
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

function totals(
	energy: ReturnType<typeof total>,
	protein = total(90),
	carbs = total(200),
	fat = total(60),
) {
	return {
		energy,
		protein,
		carbs,
		fat,
		saturatedFat: total(10),
		fibre: total(20),
		sugars: total(30),
		salt: total(2),
	};
}

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

function currentWeekReview() {
	const goals = [
		{ nutrient: "energy", direction: "min", target: 1800 },
		{ nutrient: "energy", direction: "max", target: 2200 },
		{ nutrient: "protein", direction: "min", target: 100 },
		{ nutrient: "carbs", direction: "max", target: 250 },
	];
	return {
		startDate: "2026-09-14",
		endDate: "2026-09-20",
		days: [
			{
				date: "2026-09-14",
				entryCount: 3,
				totals: totals(total(2000), total(110), total(240), total(70)),
				goals,
				goalBasis: "effective",
				effectiveFrom: "2026-09-01",
			},
			{
				date: "2026-09-15",
				entryCount: 2,
				totals: totals(
					total(1000, { incomplete: true }),
					total(0, { qualified: true }),
					total(260, { incomplete: true }),
				),
				goals,
				goalBasis: "effective",
				effectiveFrom: "2026-09-01",
			},
			{
				date: "2026-09-16",
				entryCount: 0,
				totals: emptyTotals,
				goals,
				goalBasis: "effective",
				effectiveFrom: "2026-09-01",
			},
			...Array.from({ length: 4 }, (_, index) => ({
				date: `2026-09-${17 + index}`,
				entryCount: 0,
				totals: emptyTotals,
				goals,
				goalBasis: "effective",
				effectiveFrom: "2026-09-01",
			})),
		],
		averages: {
			energy: 2000,
			energyDays: 1,
			energyQualified: false,
			protein: 55,
			proteinDays: 2,
			proteinQualified: true,
		},
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	mockConnected = true;
	mockGetOperations.mockReturnValue([]);
	mockUseQuery.mockReturnValue(currentWeekReview());
});

describe("Nutrition Week overview screen", () => {
	it("renders seven visual day buttons with truthful states and averages", () => {
		const onSelectDay = jest.fn();
		render(
			<NutritionWeeklyReviewScreen
				startDate="2026-09-16"
				today="2026-09-16"
				onSelectDay={onSelectDay}
			/>,
		);

		expect(screen.getByText("Week overview")).toBeTruthy();
		expect(screen.getByText("Today")).toBeTruthy();
		expect(screen.getAllByText("Upcoming")).toHaveLength(4);
		expect(screen.getByText("3 entries")).toBeTruthy();
		expect(screen.getAllByText("No entries").length).toBeGreaterThan(0);
		expect(screen.queryByText("Mark complete")).toBeNull();
		expect(screen.queryByText("Close")).toBeNull();
		expect(screen.getByText("Energy average")).toBeTruthy();
		expect(screen.getByText("2000 kcal · 1 day")).toBeTruthy();
		expect(screen.getByText("~ 55 g · 2 days")).toBeTruthy();
		expect(screen.getByText("≥ 1000 kcal")).toBeTruthy();
		expect(screen.getAllByText("Incomplete").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Within").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Met").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Exceeded").length).toBeGreaterThan(0);
		expect(screen.getAllByText("No goal").length).toBeGreaterThan(0);
		expect(
			screen.getByLabelText(
				/Open Monday, September 14.*Energy: 2000 kcal.*1800–2200 kcal.*Within.*Protein: 110 g.*At least 100 g.*Met/,
			),
		).toBeTruthy();
		expect(
			screen
				.getAllByRole("button")
				.some((button) => button.props.accessibilityState?.disabled === true),
		).toBe(true);

		fireEvent.press(screen.getByLabelText(/Open Monday, September 14/));
		expect(onSelectDay).toHaveBeenCalledWith("2026-09-14");
	});

	it("keeps an entirely empty week navigable without inventing an average", () => {
		const review = currentWeekReview();
		mockUseQuery.mockReturnValue({
			...review,
			days: review.days.map((day) => ({
				...day,
				entryCount: 0,
				totals: emptyTotals,
			})),
			averages: {
				energyDays: 0,
				proteinDays: 0,
				energyQualified: false,
				proteinQualified: false,
			},
		});
		render(
			<NutritionWeeklyReviewScreen
				startDate="2026-09-16"
				today="2026-09-16"
				onSelectDay={jest.fn()}
			/>,
		);

		expect(
			screen
				.getAllByRole("button")
				.filter((button) =>
					button.props.accessibilityLabel?.startsWith("Open "),
				),
		).toHaveLength(7);
		expect(screen.getAllByText("No average available")).toHaveLength(2);
	});

	it("discloses pending device operations and renders a matching loading skeleton", () => {
		mockGetOperations.mockReturnValue([{ status: "pending" }]);
		const { rerender } = render(
			<NutritionWeeklyReviewScreen
				today="2026-09-16"
				onSelectDay={jest.fn()}
			/>,
		);
		expect(
			screen.getByText(
				"Some saved meals are still waiting to sync; this overview shows synced diary data only.",
			),
		).toBeTruthy();

		mockUseQuery.mockReturnValue(undefined);
		rerender(
			<NutritionWeeklyReviewScreen
				today="2026-09-16"
				onSelectDay={jest.fn()}
			/>,
		);
		expect(screen.getByLabelText("Loading Week overview")).toBeTruthy();
	});

	it("replaces a stalled loading state with the offline recovery message", () => {
		jest.useFakeTimers();
		mockConnected = false;
		mockUseQuery.mockReturnValue(undefined);
		try {
			render(
				<NutritionWeeklyReviewScreen
					today="2026-09-16"
					onSelectDay={jest.fn()}
				/>,
			);
			expect(screen.getByLabelText("Loading Week overview")).toBeTruthy();
			act(() => jest.advanceTimersByTime(OFFLINE_GRACE_MS));
			expect(
				screen.getByText("This Week overview is not on this phone yet"),
			).toBeTruthy();
			expect(screen.getByText("Try again")).toBeTruthy();
		} finally {
			jest.useRealTimers();
		}
	});
});
