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
	expect(screen.getAllByText("80 × 8")).toHaveLength(2);
});

describe.each([
	{
		locale: "en",
		plain: "set 1, 80 kilograms, 8 reps",
		noted: "set 2, 80 kilograms, 8 reps, note: narrow grip",
		warmup: "set 3, 20 kilograms, 1 rep, Warm-up",
		pounds: "set 4, 135 pounds, 5 reps",
		bodyweight: "set 1, 8 reps",
	},
	{
		locale: "nl",
		plain: "set 1, 80 kilo, 8 herhalingen",
		noted: "set 2, 80 kilo, 8 herhalingen, notitie: narrow grip",
		warmup: "set 3, 20 kilo, 1 herhaling, Warming-up",
		pounds: "set 4, 135 pond, 5 herhalingen",
		bodyweight: "set 1, 8 herhalingen",
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

	it("says a bodyweight set without a load", async () => {
		mockSets.mockReturnValue([{ ...set("a", 1), weight: 0 }]);
		await renderScreen(<SessionSummaryScreen />);
		expect(screen.getByLabelText(expected.bodyweight)).toBeTruthy();
	});
});
