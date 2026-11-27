import { screen } from "@testing-library/react-native";
import { renderThemed } from "../test-support/render-themed";
import { AppText, TextScaleCap } from "./text";

const scaleOf = (text: string) =>
	screen.getByText(text).props.maxFontSizeMultiplier;

it("grows with Dynamic Type outside a cap", async () => {
	await renderThemed(<AppText>Free</AppText>);
	expect(scaleOf("Free")).toBeUndefined();
});

it("stops growing at the cap around it (the session dock, APP-923)", async () => {
	await renderThemed(
		<TextScaleCap.Provider value={1.5}>
			<AppText>Capped</AppText>
		</TextScaleCap.Provider>,
	);
	expect(scaleOf("Capped")).toBe(1.5);
});

it("keeps a text's own cap inside a region cap", async () => {
	await renderThemed(
		<TextScaleCap.Provider value={1.5}>
			<AppText maxFontSizeMultiplier={1.2}>Own</AppText>
		</TextScaleCap.Provider>,
	);
	expect(scaleOf("Own")).toBe(1.2);
});
