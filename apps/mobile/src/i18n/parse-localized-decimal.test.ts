import { localizeDecimal, parseLocalizedDecimal } from ".";

it.each([
	["2,5", 2.5],
	["2.5", 2.5],
	[" 12 ", 12],
	[",5", 0.5],
	["3,", 3],
	["-1,25", -1.25],
])("reads %p as %p", (text, value) => {
	expect(parseLocalizedDecimal(text)).toBe(value);
});

it.each(["", "  ", "abc", "1.000,5", "1e3", "0x10", "2,5,1"])(
	"rejects %p",
	(text) => {
		expect(parseLocalizedDecimal(text)).toBeUndefined();
	},
);

it("reads back what it wrote in either language", () => {
	expect(parseLocalizedDecimal(localizeDecimal("72.5", "nl"))).toBe(72.5);
	expect(parseLocalizedDecimal(localizeDecimal("72.5", "en"))).toBe(72.5);
});
