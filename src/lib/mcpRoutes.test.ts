import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routeTreeSource = readFileSync("src/routeTree.gen.ts", "utf8");

describe("MCP routes", () => {
	it("exposes the MCP endpoint and OAuth discovery", () => {
		expect(routeTreeSource).toContain("'/mcp'");
		expect(routeTreeSource).toContain("'/.well-known/$'");
		expect(routeTreeSource).not.toContain("'/mcp/auth'");
	});
});
