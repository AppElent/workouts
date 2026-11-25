import { fireEvent, screen } from "@testing-library/react-native";
import { View as MockView, Pressable } from "react-native";
import CoachTabsLayout from "../../app/(app)/(coach)/_layout";
import { renderScreen } from "../test-support/render-screen";
import { useI18n } from ".";

jest.mock("expo-router/native-tabs", () => {
	const Pass = ({ children }: { children?: React.ReactNode }) => children;
	const Trigger = Object.assign(
		({ name, accessibilityLabel }: Record<string, string>) => (
			<MockView testID={name} accessibilityLabel={accessibilityLabel} />
		),
		{ Label: Pass, Icon: () => null },
	);
	return { NativeTabs: Object.assign(Pass, { Trigger }) };
});
jest.mock("expo-router", () => ({ useSegments: () => [] }));
jest.mock("../data/session-data", () => ({ useActiveSession: () => null }));
jest.mock("../features/onboarding/first-run/use-first-run-prompt", () => ({
	useFirstRunPrompt: () => {},
}));
jest.mock("../features/strength-session/components/active-session-bar", () => ({
	ActiveSessionBar: () => null,
}));

function SwitchToDutch() {
	const { setLocale } = useI18n();
	return <Pressable testID="to-dutch" onPress={() => setLocale("nl")} />;
}

it("gives every tab an accessibility label that follows a language switch", async () => {
	await renderScreen(
		<>
			<SwitchToDutch />
			<CoachTabsLayout />
		</>,
	);
	const labels = () =>
		["(home)", "train", "nutrition", "progress", "profile"].map(
			(name) => screen.getByTestId(name).props.accessibilityLabel,
		);
	expect(labels()).toEqual([
		"Home",
		"Train",
		"Nutrition",
		"Progress",
		"Profile",
	]);

	await fireEvent.press(screen.getByTestId("to-dutch"));

	expect(labels()).toEqual([
		"Home",
		"Trainen",
		"Voeding",
		"Voortgang",
		"Profiel",
	]);
});
