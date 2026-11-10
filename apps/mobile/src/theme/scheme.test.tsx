import { screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { PREFERENCE_KEYS, removeLocal } from "../local-store/local-store";
import { renderThemed as render } from "../test-support/render-themed";
import { SportIcon } from "../ui/coach";
import { AppText } from "../ui/text";
import { sportMeta, useScheme, useTokens } from "./index";
import { darkColors, lightColors } from "./tokens";

function Probe() {
	const tokens = useTokens();
	const host = useScheme();
	return (
		<ReactNative.Text testID="probe">{`${tokens.bg}|${host}`}</ReactNative.Text>
	);
}

describe("scheme plumbing follows the device by default", () => {
	let scheme: jest.SpyInstance;
	beforeEach(() => {
		removeLocal(PREFERENCE_KEYS.appearance);
		scheme = jest.spyOn(ReactNative, "useColorScheme");
	});
	afterEach(() => scheme.mockRestore());

	it.each(["light", "dark"] as const)(
		"matches the OS %s scheme in content and native hosts",
		async (mode) => {
			scheme.mockReturnValue(mode);
			await render(<Probe />);
			const tokens = mode === "dark" ? darkColors : lightColors;
			expect(screen.getByTestId("probe").props.children).toBe(
				`${tokens.bg}|${mode}`,
			);
		},
	);

	it("AppText takes its ink from the tokens, and a caller's style still wins", async () => {
		scheme.mockReturnValue("light");
		await render(
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
		expect(flat("body").color).toBe(lightColors.text);
		expect(flat("muted").color).toBe(lightColors.textMuted);
		expect(flat("override").color).toBe("#123456");
	});

	it("SportIcon draws the light hue", async () => {
		scheme.mockReturnValue("light");
		await render(<SportIcon sport="running" />);
		const glyph = screen.getByText(sportMeta.running.glyph);
		expect(ReactNative.StyleSheet.flatten(glyph.props.style).color).toBe(
			"#9d430a",
		);
	});
});
