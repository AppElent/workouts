import { fireEvent, screen } from "@testing-library/react-native";
import { PREFERENCE_KEYS, writeLocal } from "../../../local-store/local-store";
import { renderScreen } from "../../../test-support/render-screen";
import { SessionExercisePicker } from "./session-exercise-picker";

jest.mock("../../../convex/query-cache", () => ({ useQuery: () => [] }));

afterEach(() => writeLocal(PREFERENCE_KEYS.locale, "en"));

async function typeNew(onCreate: jest.Mock, name: string) {
	await renderScreen(
		<SessionExercisePicker
			title="Add exercise"
			exercises={[]}
			inSession={[]}
			onPick={jest.fn()}
			onCreate={onCreate}
			onClose={jest.fn()}
		/>,
	);
	await fireEvent.changeText(screen.getByTestId("session-picker-search"), name);
}

it("quick-creates a weighted, bodyweight, or seconds exercise", async () => {
	const onCreate = jest.fn();
	await typeNew(onCreate, "Wall sit");
	expect(screen.getByText("New with weight: Wall sit")).toBeTruthy();
	expect(screen.getByText("New on bodyweight: Wall sit")).toBeTruthy();
	await fireEvent.press(screen.getByText("New in seconds: Wall sit"));
	expect(onCreate).toHaveBeenCalledWith("Wall sit", "hold");
});

it("offers seconds in Dutch", async () => {
	writeLocal(PREFERENCE_KEYS.locale, "nl");
	const onCreate = jest.fn();
	await typeNew(onCreate, "Plank");
	await fireEvent.press(screen.getByText("Nieuw in seconden: Plank"));
	expect(onCreate).toHaveBeenCalledWith("Plank", "hold");
});
