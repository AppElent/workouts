import { screen } from "@testing-library/react-native";
import { LocaleProvider } from "../../../i18n";
import { PREFERENCE_KEYS, writeLocal } from "../../../local-store/local-store";
import { renderThemed } from "../../../test-support/render-themed";
import { HistoryTab } from "./exercise-detail-screen";
import { exerciseInsight } from "./exercise-insight";

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: jest.fn() }),
	useLocalSearchParams: () => ({}),
	Stack: { Screen: () => null },
}));

const NOW = new Date(2026, 10, 18, 12).getTime();
const set = (
	id: string,
	setNumber: number,
	extra: { weight?: number; reps?: number; notes?: string } = {},
) => ({
	_id: id,
	sessionId: "s1",
	sessionDate: NOW,
	setNumber,
	weight: extra.weight ?? 80,
	unit: "kg" as const,
	reps: extra.reps ?? 8,
	setType: "working",
	...(extra.notes === undefined ? {} : { notes: extra.notes }),
});

const render = (...sets: ReturnType<typeof set>[]) =>
	renderThemed(
		<HistoryTab
			timed={false}
			sessions={exerciseInsight(sets, [], NOW).sessions}
		/>,
		{ wrapper: LocaleProvider },
	);

afterEach(() => writeLocal(PREFERENCE_KEYS.locale, "en"));

it("shows a set's note under the set", async () => {
	await render(set("a", 1, { notes: " narrow grip " }), set("b", 2));
	expect(screen.getByText("narrow grip")).toBeTruthy();
	expect(screen.getAllByText(/^80 × 8$/)).toHaveLength(2);
});

describe.each([
	{
		locale: "en",
		withEstimate: /^set 1, 20 kilograms, 5 reps, 1RM about \d+ kilograms$/,
		withNote:
			/^set 1, 20 kilograms, 5 reps, 1RM about \d+ kilograms, note: narrow grip$/,
		bodyweight: "set 1, 5 reps",
		bodyweightNote: "set 1, 5 reps, note: narrow grip",
		single: "set 1, 20 kilograms, 1 rep",
	},
	{
		locale: "nl",
		withEstimate: /^set 1, 20 kilo, 5 herhalingen, 1RM ongeveer \d+ kilo$/,
		withNote:
			/^set 1, 20 kilo, 5 herhalingen, 1RM ongeveer \d+ kilo, notitie: narrow grip$/,
		bodyweight: "set 1, 5 herhalingen",
		bodyweightNote: "set 1, 5 herhalingen, notitie: narrow grip",
		single: "set 1, 20 kilo, 1 herhaling",
	},
])("a history row spoken in $locale", (expected) => {
	beforeEach(() => writeLocal(PREFERENCE_KEYS.locale, expected.locale));

	it("is one element: load, reps and estimate, no note", async () => {
		await render(set("a", 1, { weight: 20, reps: 5 }));
		expect(screen.getByLabelText(expected.withEstimate)).toBeTruthy();
	});

	it("adds the note", async () => {
		await render(set("a", 1, { weight: 20, reps: 5, notes: "narrow grip" }));
		expect(screen.getByLabelText(expected.withNote)).toBeTruthy();
	});

	it("leaves the estimate out, and never reads the placeholder", async () => {
		await render(set("a", 1, { weight: 0, reps: 5 }));
		expect(screen.getByLabelText(expected.bodyweight)).toBeTruthy();
		await screen.unmount();
		await render(set("a", 1, { weight: 0, reps: 5, notes: "narrow grip" }));
		expect(screen.getByLabelText(expected.bodyweightNote)).toBeTruthy();
		expect(screen.getAllByLabelText(/^set \d/)).toHaveLength(1);
		expect(screen.queryByLabelText(/—/)).toBeNull();
	});

	it("speaks one rep in the singular", async () => {
		await render(set("a", 1, { weight: 20, reps: 1 }));
		expect(
			screen.getByLabelText(new RegExp(`^${expected.single}, `)),
		).toBeTruthy();
	});

	it("is a single accessible element for every set", async () => {
		await render(set("a", 1), set("b", 2, { notes: "x" }));
		expect(screen.getAllByLabelText(/^set [12], /)).toHaveLength(2);
	});
});
