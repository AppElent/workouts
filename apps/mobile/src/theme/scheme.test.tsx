import { render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { SportIcon } from "../ui/coach";
import { AppText } from "../ui/text";
import {
	colors,
	colorsLight,
	lightModeEnabled,
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

describe("scheme plumbing while light mode is off", () => {
	let scheme: jest.SpyInstance;
	beforeEach(() => {
		scheme = jest.spyOn(ReactNative, "useColorScheme");
	});
	afterEach(() => scheme.mockRestore());

	it("is off", () => {
		expect(lightModeEnabled).toBe(false);
	});

	it("ignores an OS light scheme — iOS 26 reports traits the ground does not match", () => {
		scheme.mockReturnValue("light");
		render(<Probe />);
		expect(screen.getByTestId("probe").props.children).toBe(
			`${colors.bg}|dark`,
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
		expect(flat("body").color).toBe(colors.text);
		expect(flat("muted").color).toBe(colors.textMuted);
		expect(flat("override").color).toBe("#123456");
	});

	it("SportIcon draws the dark hue", () => {
		scheme.mockReturnValue("light");
		render(<SportIcon sport="running" />);
		const glyph = screen.getByText(sportMeta.running.glyph);
		expect(ReactNative.StyleSheet.flatten(glyph.props.style).color).toBe(
			sportMeta.running.color,
		);
	});
});
