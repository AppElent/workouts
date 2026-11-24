import { screen } from "@testing-library/react-native";
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

it("shows a set's note under its chip and speaks it with the set", async () => {
	mockSets.mockReturnValue([set("a", 1, "narrow grip"), set("b", 2)]);
	await renderScreen(<SessionSummaryScreen />);
	expect(screen.getByText("narrow grip")).toBeTruthy();
	expect(screen.getByLabelText("80 × 8, note: narrow grip")).toBeTruthy();
});

it("leaves sets without a note as they were", async () => {
	mockSets.mockReturnValue([set("a", 1), set("b", 2)]);
	await renderScreen(<SessionSummaryScreen />);
	expect(screen.getAllByText("80 × 8")).toHaveLength(2);
	expect(screen.queryByLabelText(/note:/)).toBeNull();
});
