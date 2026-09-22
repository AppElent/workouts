import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Storage from "expo-sqlite/kv-store";
import { useState } from "react";
import { Appearance, Pressable, Text, TextInput, View } from "react-native";
import {
	clearPreference,
	PREFERENCE_KEYS,
	writePreference,
} from "../prefs/local-preference";
import {
	AppearanceProvider,
	useAppearance,
	useThemedStyles,
} from "./appearance";
import { darkColors, lightColors, type Tokens } from "./tokens";

// RN's preset replaces this subscription with a constant light-mode mock.
// Exercise the real hook against the native Appearance boundary below.
jest.unmock("react-native/Libraries/Utilities/useColorScheme");

const createStyles = (colors: Tokens) => ({
	root: { backgroundColor: colors.bg },
});
function Probe() {
	const { preference, scheme, colors, setPreference } = useAppearance();
	const styles = useThemedStyles(createStyles);
	const [text, setText] = useState("");
	return (
		<View testID="surface" style={styles.root}>
			<Text testID="scheme" style={{ color: colors.text }}>
				{preference}/{scheme}
			</Text>
			<TextInput
				accessibilityLabel="Draft"
				value={text}
				onChangeText={setText}
			/>
			{(["system", "light", "dark"] as const).map((choice) => (
				<Pressable
					key={choice}
					accessibilityLabel={choice}
					onPress={() => setPreference(choice)}
				>
					<Text>{choice}</Text>
				</Pressable>
			))}
		</View>
	);
}

let system: "light" | "dark";
let override: "light" | "dark" | "unspecified";
const listeners = new Set<(event: { colorScheme: "light" | "dark" }) => void>();
function changeSystem(next: "light" | "dark") {
	system = next;
	act(() => {
		for (const listener of listeners)
			listener({ colorScheme: override === "unspecified" ? system : override });
	});
}

beforeEach(() => {
	clearPreference(PREFERENCE_KEYS.appearance);
	system = "light";
	override = "unspecified";
	listeners.clear();
	jest
		.spyOn(Appearance, "getColorScheme")
		.mockImplementation(() => (override === "unspecified" ? system : override));
	jest.spyOn(Appearance, "setColorScheme").mockImplementation((next) => {
		override = next === "light" || next === "dark" ? next : "unspecified";
	});
	jest.spyOn(Appearance, "addChangeListener").mockImplementation((listener) => {
		listeners.add(listener);
		return {
			remove: () => {
				listeners.delete(listener);
			},
		};
	});
});
afterEach(() => {
	jest.restoreAllMocks();
});

it("defaults to System and follows live device changes", () => {
	render(
		<AppearanceProvider>
			<Probe />
		</AppearanceProvider>,
	);
	expect(screen.getByTestId("scheme").props.children).toEqual([
		"system",
		"/",
		"light",
	]);
	changeSystem("dark");
	expect(screen.getByTestId("surface")).toHaveStyle({
		backgroundColor: darkColors.bg,
	});
	changeSystem("light");
	expect(screen.getByTestId("surface")).toHaveStyle({
		backgroundColor: lightColors.bg,
	});
});

it.each([
	"light",
	"dark",
] as const)("paints the first frame in saved %s appearance", (choice) => {
	writePreference(PREFERENCE_KEYS.appearance, choice);
	render(
		<AppearanceProvider>
			<Probe />
		</AppearanceProvider>,
	);
	expect(screen.getByTestId("scheme").props.children).toEqual([
		choice,
		"/",
		choice,
	]);
	expect(Appearance.setColorScheme).toHaveBeenCalledWith(choice);
});

it("keeps an override, updates mounted styles, and preserves input while switching", () => {
	render(
		<AppearanceProvider>
			<Probe />
		</AppearanceProvider>,
	);
	fireEvent.changeText(screen.getByLabelText("Draft"), "Unsaved recipe");
	fireEvent.press(screen.getByLabelText("dark"));
	changeSystem("light");
	expect(screen.getByTestId("surface")).toHaveStyle({
		backgroundColor: darkColors.bg,
	});
	expect(screen.getByLabelText("Draft").props.value).toBe("Unsaved recipe");
	fireEvent.press(screen.getByLabelText("system"));
	expect(screen.getByTestId("surface")).toHaveStyle({
		backgroundColor: lightColors.bg,
	});
	expect(screen.getByLabelText("Draft").props.value).toBe("Unsaved recipe");
});

it("persists the selected appearance across provider remounts", () => {
	const first = render(
		<AppearanceProvider>
			<Probe />
		</AppearanceProvider>,
	);
	fireEvent.press(screen.getByLabelText("dark"));
	first.unmount();
	render(
		<AppearanceProvider>
			<Probe />
		</AppearanceProvider>,
	);
	expect(screen.getByTestId("scheme").props.children).toEqual([
		"dark",
		"/",
		"dark",
	]);
});

it("falls back to System for invalid or unreadable stored choices", () => {
	jest.spyOn(Storage, "getItemSync").mockImplementation(() => {
		throw new Error("storage unavailable");
	});
	render(
		<AppearanceProvider>
			<Probe />
		</AppearanceProvider>,
	);
	expect(screen.getByTestId("scheme").props.children).toEqual([
		"system",
		"/",
		"light",
	]);
});
