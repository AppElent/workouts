import { screen } from "@testing-library/react-native";
import { PREFERENCE_KEYS, writeLocal } from "../../../local-store/local-store";
import { renderScreen } from "../../../test-support/render-screen";
import { SessionSummaryScreen } from "./session-summary-screen";

jest.mock("expo-router", () => ({
	useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
	useLocalSearchParams: () => ({ id: "session-1" }),
	Stack: { Screen: () => null },
}));
jest.mock("convex/react", () => ({ useMutation: () => jest.fn() }));
jest.mock("../../../convex/query-cache", () => ({
	useQuery: () => [],
}));
jest.mock("../../../data/exercises", () => ({
	useExercises: () => [{ _id: "bench", name: "Bench press" }],
}));

const mockSets = jest.fn();
jest.mock("../../../data/session-data", () => ({
	...jest.requireActual("../../../data/session-data"),
	useSession: () => ({
		_id: "session-1",
		name: "Push day",
		date: new Date(2026, 10, 18).getTime(),
		startTime: 0,
		endTime: 60_000,
		status: "completed",
	}),
	useSessionSets: () => mockSets(),
}));

const set = (id: string, setNumber: number, notes?: string) => ({
	_id: id,
	exerciseId: "bench",
	setNumber,
	weight: 80,
	unit: "kg",
	reps: 8,
	setType: "working",
	loggedAt: setNumber,
	...(notes === undefined ? {} : { notes }),
});

afterEach(() => writeLocal(PREFERENCE_KEYS.locale, "en"));

it("shows a set's note under its chip", async () => {
	mockSets.mockReturnValue([set("a", 1, "narrow grip"), set("b", 2)]);
	await renderScreen(<SessionSummaryScreen />);
	expect(screen.getByText("narrow grip")).toBeTruthy();
	expect(screen.getAllByText("80 kg × 8")).toHaveLength(2);
});

describe.each([
	{ locale: "en", reps: "8 reps", best: "Best: 80 kg × 8" },
	{ locale: "nl", reps: "8 herh.", best: "Beste: 80 kg × 8" },
])("the visible chip in $locale", ({ locale, reps, best }) => {
	beforeEach(() => writeLocal(PREFERENCE_KEYS.locale, locale));

	it("names the unit of a weighted set; bodyweight has none", async () => {
		mockSets.mockReturnValue([
			set("a", 1),
			{ ...set("b", 2), weight: 135, reps: 5, unit: "lbs" },
			{ ...set("c", 3), weight: 0 },
		]);
		await renderScreen(<SessionSummaryScreen />);
		expect(screen.getByText("80 kg × 8")).toBeTruthy();
		expect(screen.getByText("135 lbs × 5")).toBeTruthy();
		expect(screen.getByText(reps)).toBeTruthy();
		expect(screen.getByText(best)).toBeTruthy();
	});

	it("puts the unit on a timed hold's added load", async () => {
		mockSets.mockReturnValue([
			{
				...set("a", 1),
				exerciseId: "shipped:exercise:plank",
				weight: 10,
				reps: 30,
				unit: "lbs",
			},
		]);
		await renderScreen(<SessionSummaryScreen />);
		expect(screen.getByText("+10 lbs × 30 s")).toBeTruthy();
	});
});

it("compares and totals kg and lbs sets in one unit", async () => {
	mockSets.mockReturnValue([
		set("a", 1),
		{ ...set("b", 2), weight: 135, reps: 5, unit: "lbs" },
	]);
	await renderScreen(<SessionSummaryScreen />);
	expect(screen.getByText("Best: 80 kg × 8")).toBeTruthy();
	// 80 kg × 8 + 135 lbs (61.23 kg) × 5
	expect(screen.getByText("946 kg")).toBeTruthy();
});

it("shows the winning set in its own unit", async () => {
	mockSets.mockReturnValue([
		set("a", 1),
		{ ...set("b", 2), weight: 185, reps: 3, unit: "lbs" },
	]);
	await renderScreen(<SessionSummaryScreen />);
	expect(screen.getByText("Best: 185 lbs × 3")).toBeTruthy();
});

describe.each([
	{
		locale: "en",
		plain: "set 1, 80 kilograms, 8 reps",
		noted: "set 2, 80 kilograms, 8 reps, note: narrow grip",
		warmup: "set 3, 20 kilograms, 1 rep, Warm-up",
		pounds: "set 4, 135 pounds, 5 reps",
		bodyweight: "set 1, 8 reps",
		withRpe: "set 1, 80 kilograms, 8 reps, RPE 8.5, note: narrow grip",
	},
	{
		locale: "nl",
		plain: "set 1, 80 kilo, 8 herhalingen",
		noted: "set 2, 80 kilo, 8 herhalingen, notitie: narrow grip",
		warmup: "set 3, 20 kilo, 1 herhaling, Warming-up",
		pounds: "set 4, 135 pond, 5 herhalingen",
		bodyweight: "set 1, 8 herhalingen",
		withRpe: "set 1, 80 kilo, 8 herhalingen, RPE 8,5, notitie: narrow grip",
	},
])("a summary set spoken in $locale", (expected) => {
	beforeEach(() => writeLocal(PREFERENCE_KEYS.locale, expected.locale));

	it("is one accessible element per set, with and without a note", async () => {
		mockSets.mockReturnValue([
			set("a", 1),
			set("b", 2, "narrow grip"),
			{ ...set("c", 3), weight: 20, reps: 1, setType: "warmup" },
			{ ...set("d", 4), weight: 135, reps: 5, unit: "lbs" },
		]);
		await renderScreen(<SessionSummaryScreen />);
		expect(screen.getByLabelText(expected.plain)).toBeTruthy();
		expect(screen.getByLabelText(expected.noted)).toBeTruthy();
		expect(screen.getByLabelText(expected.warmup)).toBeTruthy();
		expect(screen.getByLabelText(expected.pounds)).toBeTruthy();
		expect(screen.getAllByLabelText(/^set \d/)).toHaveLength(4);
	});

	it("speaks a set's RPE before its note", async () => {
		mockSets.mockReturnValue([{ ...set("a", 1, "narrow grip"), rpe: 8.5 }]);
		await renderScreen(<SessionSummaryScreen />);
		expect(screen.getByLabelText(expected.withRpe)).toBeTruthy();
	});

	it("says a bodyweight set without a load", async () => {
		mockSets.mockReturnValue([{ ...set("a", 1), weight: 0 }]);
		await renderScreen(<SessionSummaryScreen />);
		expect(screen.getByLabelText(expected.bodyweight)).toBeTruthy();
	});
});
