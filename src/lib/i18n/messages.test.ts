import { isAppErrorCode, messageParityMismatches } from "@foundry/core";
import { expect, it } from "vitest";
import { MESSAGES } from ".";

it("says the same things in every language, with the same placeholders", () => {
	expect(messageParityMismatches(MESSAGES)).toEqual([]);
});

it("words only server error codes, in every language", () => {
	for (const messages of Object.values(MESSAGES))
		expect(
			Object.keys(messages.errors).filter((code) => !isAppErrorCode(code)),
		).toEqual([]);
});

it("calls the web Profile page the same in the nav and the header menu", () => {
	for (const messages of Object.values(MESSAGES))
		expect(messages.auth.header.account).toBe(messages.nav.profile.label);
});
