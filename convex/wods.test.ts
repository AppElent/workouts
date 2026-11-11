/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

it("lists a catalog WOD that still carries a userId once", async () => {
	const t = convexTest(schema, modules);
	await t.run(async (ctx) => {
		const wod = { type: "forTime" as const, movements: [] };
		await ctx.db.insert("wods", {
			...wod,
			name: "Fran",
			isDefault: true,
			userId: "alice",
		});
		await ctx.db.insert("wods", {
			...wod,
			name: "Mine",
			isDefault: false,
			userId: "alice",
		});
	});
	const names = (
		await t.withIdentity({ subject: "alice" }).query(api.wods.list, {})
	).map((wod) => wod.name);
	expect(names).toEqual(["Fran", "Mine"]);
});
