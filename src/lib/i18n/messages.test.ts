import { isAppErrorCode, messageParityMismatches } from "@foundry/core";
import { expect, it } from "vitest";
import { en } from "./messages/en";
import { nl } from "./messages/nl";

it("says the same things in both languages, with the same placeholders", () => {
	expect(messageParityMismatches({ en, nl })).toEqual([]);
});

it("words only server error codes, in both languages", () => {
	for (const messages of [en, nl])
		expect(
			Object.keys(messages.errors).filter((code) => !isAppErrorCode(code)),
		).toEqual([]);
});
