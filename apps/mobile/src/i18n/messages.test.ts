/**
 * `satisfies typeof en` in `nl.ts` already catches a missing or extra key at
 * typecheck time. This also catches a translation that drops or invents a
 * `{placeholder}`, which would reach the user as a literal brace.
 */
import { isAppErrorCode, messageParityMismatches } from "@foundry/core";
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
