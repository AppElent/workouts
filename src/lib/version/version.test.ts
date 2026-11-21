import { convexDeployment, versionResponse } from "./version";

it("serves the version info as uncached JSON", async () => {
	const info = {
		version: "1.0.0",
		commit: "a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0",
		environment: "production",
		release: "foundry@1.0.0+a1b2c3d",
		builtAt: "2026-11-17T07:00:00.000Z",
		convex: "giddy-otter-123",
	};

	const response = versionResponse(info);

	expect(response.headers.get("cache-control")).toBe("no-store");
	expect(await response.json()).toEqual(info);
});

it("names the Convex deployment from its client URL", () => {
	expect(
		convexDeployment("https://giddy-otter-123.eu-west-1.convex.cloud"),
	).toBe("giddy-otter-123");
	expect(convexDeployment(undefined)).toBeNull();
	expect(convexDeployment("not a url")).toBeNull();
});
