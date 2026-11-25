import { expect, it } from "vitest";
import { ACCOUNT_PORTAL_URL } from "./account-portal";

it("points at the AppElent account portal", () => {
	expect(ACCOUNT_PORTAL_URL).toBe("https://account.appelent.nl");
});
