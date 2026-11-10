import { messageParityMismatches } from "@foundry/core";
import { expect, it } from "vitest";
import { en } from "./messages/en";
import { nl } from "./messages/nl";

it("says the same things in both languages, with the same placeholders", () => {
	expect(messageParityMismatches({ en, nl })).toEqual([]);
});
