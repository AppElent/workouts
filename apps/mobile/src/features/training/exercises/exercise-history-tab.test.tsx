import { screen } from "@testing-library/react-native";
import { LocaleProvider } from "../../../i18n";
import { renderThemed } from "../../../test-support/render-themed";
import { HistoryTab } from "./exercise-detail-screen";
import { exerciseInsight } from "./exercise-insight";

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: jest.fn() }),
	useLocalSearchParams: () => ({}),
	Stack: { Screen: () => null },
}));

const NOW = new Date(2026, 10, 18, 12).getTime();
const set = (id: string, setNumber: number, notes?: string) => ({
	_id: id,
	sessionId: "s1",
	sessionDate: NOW,
	setNumber,
	weight: 80,
	unit: "kg" as const,
	reps: 8,
	setType: "working",
	...(notes === undefined ? {} : { notes }),
});

const render = (notes: { first?: string; second?: string }) =>
	renderThemed(
		<HistoryTab
			timed={false}
			sessions={
				exerciseInsight(
					[set("a", 1, notes.first), set("b", 2, notes.second)],
					[],
					NOW,
				).sessions
			}
		/>,
		{ wrapper: LocaleProvider },
	);

it("shows a set's note under the set and speaks it with the row", async () => {
	await render({ first: " narrow grip " });
	expect(screen.getByText("narrow grip")).toBeTruthy();
	expect(
		screen.getByLabelText(/^1, 80 × 8, ≈ \d+, note: narrow grip$/),
	).toBeTruthy();
	expect(screen.getAllByLabelText(/note:/)).toHaveLength(1);
});

it("leaves sets without a note as they were", async () => {
	await render({});
	expect(screen.queryByLabelText(/note:/)).toBeNull();
	expect(screen.getAllByText(/^80 × 8$/)).toHaveLength(2);
});
