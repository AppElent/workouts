import { expect, it } from "vitest";
import { formatShortDate } from "./format";

const at = new Date(2026, 10, 26, 12).getTime();

it("writes a short date in the reader's language", () => {
	expect(formatShortDate("en", at)).toBe("Nov 26");
	expect(formatShortDate("nl", at)).toBe("26 nov");
});
