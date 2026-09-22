import { screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { clearPreference, PREFERENCE_KEYS } from "../prefs/local-preference";
import { renderThemed as render } from "../test-support/render-themed";
import { SportIcon } from "../ui/coach";
import { AppText } from "../ui/text";
import {
	colors,
	colorsLight,
	sportMeta,
	useHostScheme,
	useTokens,
} from "./index";

function Probe() {
	const tokens = useTokens();
	const host = useHostScheme();
	return (
		<ReactNative.Text testID="probe">{`${tokens.bg}|${host}`}</ReactNative.Text>
	);
}

describe("scheme plumbing follows the device by default", () => {
	let scheme: jest.SpyInstance;
	beforeEach(() => {
		clearPreference(PREFERENCE_KEYS.appearance);
		scheme = jest.spyOn(ReactNative, "useColorScheme");
	});
	afterEach(() => scheme.mockRestore());

	it.each([
		"light",
		"dark",
	] as const)("matches the OS %s scheme in content and native hosts", (mode) => {
		scheme.mockReturnValue(mode);
		render(<Probe />);
		const tokens = mode === "dark" ? colors : colorsLight;
		expect(screen.getByTestId("probe").props.children).toBe(
			`${tokens.bg}|${mode}`,
		);
		expect(colorsLight.bg).not.toBe(colors.bg);
	});

	it("AppText takes its ink from the tokens, and a caller's style still wins", () => {
		scheme.mockReturnValue("light");
		render(
			<>
				<AppText testID="body">a</AppText>
				<AppText testID="muted" variant="footnote">
					b
				</AppText>
				<AppText testID="override" style={{ color: "#123456" }}>
					c
				</AppText>
			</>,
		);
		const flat = (id: string) =>
			ReactNative.StyleSheet.flatten(screen.getByTestId(id).props.style);
		expect(flat("body").color).toBe(colorsLight.text);
		expect(flat("muted").color).toBe(colorsLight.textMuted);
		expect(flat("override").color).toBe("#123456");
	});

	it("SportIcon draws the light hue", () => {
		scheme.mockReturnValue("light");
		render(<SportIcon sport="running" />);
		const glyph = screen.getByText(sportMeta.running.glyph);
		expect(ReactNative.StyleSheet.flatten(glyph.props.style).color).toBe(
			"#9d430a",
		);
	});
});
