/**
 * `satisfies typeof en` in `nl.ts` already catches a missing or extra key at
 * typecheck time. This also catches a translation that drops or invents a
 * `{placeholder}`, which would reach the user as a literal brace.
 */
import { isAppErrorCode, messageParityMismatches } from "@foundry/core";
import { DICTIONARIES } from "./dictionaries";

it("says the same things in every language, with the same placeholders", () => {
	expect(messageParityMismatches(DICTIONARIES)).toEqual([]);
});

it("words only server error codes, in every language", () => {
	for (const messages of Object.values(DICTIONARIES))
		expect(
			Object.keys(messages.errors).filter((code) => !isAppErrorCode(code)),
		).toEqual([]);
});
