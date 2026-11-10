/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const metric = { weight: 80, unit: "kg" as const };

function connectedApp(scope: string) {
	return convexTest(schema, modules).withIdentity({
		subject: "alice",
		client_id: "mcp-client",
		scope,
	});
}

it("lets a read-only connected app read but not write", async () => {
	const app = connectedApp("openid foundry:read");
	expect(await app.query(api.bodyMetrics.list, {})).toEqual([]);
	await expect(app.mutation(api.bodyMetrics.add, metric)).rejects.toThrow(
		"read-only",
	);
});

it("refuses a connected app without a Foundry scope", async () => {
	const app = connectedApp("openid profile email");
	await expect(app.query(api.bodyMetrics.list, {})).rejects.toThrow(
		"no access",
	);
});

it("lets a connected app with write access write", async () => {
	const app = connectedApp("foundry:read foundry:write");
	await app.mutation(api.bodyMetrics.add, metric);
	expect(await app.query(api.bodyMetrics.list, {})).toHaveLength(1);
});

it("never lets a connected app delete the account", async () => {
	const app = connectedApp("foundry:read foundry:write");
	await expect(
		app.mutation(api.account.deleteData, { expectedSubject: "alice" }),
	).rejects.toThrow("Connected apps cannot");
});

it("leaves the app's own session unrestricted", async () => {
	const user = convexTest(schema, modules).withIdentity({ subject: "alice" });
	await user.mutation(api.bodyMetrics.add, metric);
	expect(
		await user.mutation(api.account.deleteData, { expectedSubject: "alice" }),
	).toEqual({ done: true });
});
