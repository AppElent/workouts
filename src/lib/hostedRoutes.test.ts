import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routeTreeSource = readFileSync("src/routeTree.gen.ts", "utf8");

describe("hosted workout routes", () => {
	it("exposes the public join route at /join/$token", () => {
		expect(routeTreeSource).toContain("'/join/$token'");
		expect(routeTreeSource).not.toContain("'/join-hosted/$token'");
	});
});
