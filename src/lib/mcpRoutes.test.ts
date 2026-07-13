import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routeTreeSource = readFileSync("src/routeTree.gen.ts", "utf8");

describe("MCP routes", () => {
	it("exposes MCP protocol and auth routes", () => {
		expect(routeTreeSource).toContain("'/mcp'");
		expect(routeTreeSource).toContain("'/mcp/auth'");
	});
});
