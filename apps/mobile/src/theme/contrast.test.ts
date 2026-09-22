import { darkColors, lightColors, type Tokens } from "./tokens";

function luminance(hex: string) {
	const rgb = hex
		.slice(1)
		.match(/.{2}/g)
		?.map((value) => {
			const channel = Number.parseInt(value, 16) / 255;
			return channel <= 0.04045
				? channel / 12.92
				: ((channel + 0.055) / 1.055) ** 2.4;
		});
	if (rgb?.length !== 3) throw new Error(`Expected opaque RGB: ${hex}`);
	return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
	const pair = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (pair[0] + 0.05) / (pair[1] + 0.05);
}

describe.each<[string, Tokens]>([
	["light", lightColors],
	["dark", darkColors],
])("%s semantic palette", (_name, colors) => {
	it.each([
		"bg",
		"surface",
		"surface2",
	] as const)("keeps normal text and actions readable on %s", (surface) => {
		for (const ink of [
			"text",
			"textMuted",
			"textFaint",
			"accent",
			"danger",
			"success",
			"warn",
		] as const) {
			expect(contrast(colors[ink], colors[surface])).toBeGreaterThanOrEqual(
				4.5,
			);
		}
	});
	it("keeps labels readable on normal and pressed primary actions", () => {
		expect(contrast(colors.onAccent, colors.accentFill)).toBeGreaterThanOrEqual(
			4.5,
		);
		expect(
			contrast(colors.onAccent, colors.accentPressed),
		).toBeGreaterThanOrEqual(4.5);
	});
	it("keeps destructive confirmation labels readable", () => {
		expect(contrast(colors.onDanger, colors.danger)).toBeGreaterThanOrEqual(
			4.5,
		);
	});
});
