import { describe } from "vitest";
import { assertMessageParity } from "../test-utils";

describe("assertMessageParity (self-test)", () => {
	assertMessageParity({
		en: {
			actions: { save: "Save" },
			count: { one: "{count} item", other: "{count} items" },
		},
		nl: {
			actions: { save: "Opslaan" },
			count: { one: "{count} item", other: "{count} items" },
		},
	});
});
