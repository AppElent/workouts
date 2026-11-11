/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function photoUrl(t: ReturnType<typeof convexTest>, storageId: Id<"_storage">) {
	return t.run((ctx) => ctx.storage.getUrl(storageId));
}

it("claims an uploaded food photo for its account and refuses it to another", async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity({ subject: "alice" });
	await expect(
		alice.mutation(api.nutritionFoodPhotos.generateUploadUrl, {
			expectedSubject: "bob",
		}),
	).rejects.toMatchObject({ data: { code: "accountChanged" } });
	expect(
		await alice.mutation(api.nutritionFoodPhotos.generateUploadUrl, {
			expectedSubject: "alice",
		}),
	).toEqual(expect.any(String));
	const storageId = await t.run((ctx) =>
		ctx.storage.store(new Blob(["photo"], { type: "image/jpeg" })),
	);
	await alice.mutation(api.nutritionFoodPhotos.registerUpload, {
		storageId,
		expectedSubject: "alice",
	});
	// A retry from a new client of the same account is a no-op.
	await t
		.withIdentity({ subject: "alice" })
		.mutation(api.nutritionFoodPhotos.registerUpload, {
			storageId,
			expectedSubject: "alice",
		});
	await expect(
		t
			.withIdentity({ subject: "bob" })
			.mutation(api.nutritionFoodPhotos.registerUpload, {
				storageId,
				expectedSubject: "bob",
			}),
	).rejects.toMatchObject({ data: { code: "notFound", field: "storageId" } });
	expect(
		await t.run((ctx) => ctx.db.query("nutritionFoodPhotos").collect()),
	).toMatchObject([{ userId: "alice", storageId }]);
});

it("rejects a missing, non-JPEG or oversized upload without claiming it", async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity({ subject: "alice" });
	const store = (blob: Blob) => t.run((ctx) => ctx.storage.store(blob));
	const missing = await store(new Blob(["photo"], { type: "image/jpeg" }));
	await t.run((ctx) => ctx.storage.delete(missing));
	const cases = [
		[missing, { code: "notFound", field: "storageId" }],
		[
			await store(new Blob(["photo"], { type: "image/png" })),
			{ code: "invalid", field: "contentType" },
		],
		[
			await store(
				new Blob([new Uint8Array(2_000_001)], { type: "image/jpeg" }),
			),
			{ code: "tooLarge", field: "size" },
		],
	] as const;
	for (const [storageId, data] of cases)
		await expect(
			alice.mutation(api.nutritionFoodPhotos.registerUpload, {
				storageId,
				expectedSubject: "alice",
			}),
		).rejects.toMatchObject({ data });
	expect(
		await t.run((ctx) => ctx.db.query("nutritionFoodPhotos").collect()),
	).toEqual([]);
});

it("restores a manual food's uploaded photo from its storage identifier on a fresh library read", async () => {
	const t = convexTest(schema, modules);
	const storageId = await t.run((ctx) =>
		ctx.storage.store(new Blob(["photo"], { type: "image/jpeg" })),
	);
	const alice = t.withIdentity({ subject: "alice" });
	await alice.mutation(api.nutritionFoodPhotos.registerUpload, {
		storageId,
		expectedSubject: "alice",
	});
	const payload = JSON.stringify({
		id: "manual",
		name: { en: "Soup", nl: "Soep" },
		baseUnit: "g",
		servings: [],
		nutrients: Object.fromEntries(
			[
				"energy",
				"protein",
				"carbs",
				"fat",
				"saturatedFat",
				"fibre",
				"sugars",
				"salt",
			].map((key) => [key, { kind: "absent" }]),
		),
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: false,
		},
		visual: { kind: "photo", storageId, uri: "" },
		createdAt: 1,
		updatedAt: 1,
	});
	await alice.mutation(api.nutritionLibrary.save, {
		operationId: "save-photo",
		expectedSubject: "alice",
		operation: {
			kind: "upsert",
			record: { id: "manual", kind: "food", payload },
			expectedRevision: 0,
		},
	});
	const fresh = await t
		.withIdentity({ subject: "alice" })
		.query(api.nutritionLibrary.getMany, { ids: ["manual"] });
	const visual = JSON.parse(fresh[0].payload!).visual;
	expect(visual.storageId).toBe(storageId);
	expect(visual.uri).toBe(await photoUrl(t, storageId));
	expect(visual.uri).toBeTruthy();
	await expect(
		t.withIdentity({ subject: "bob" }).mutation(api.nutritionLibrary.save, {
			operationId: "steal-photo",
			expectedSubject: "bob",
			operation: {
				kind: "upsert",
				record: { id: "manual", kind: "food", payload },
				expectedRevision: 0,
			},
		}),
	).rejects.toMatchObject({ data: { code: "notFound", field: "storageId" } });
	expect(
		await t
			.withIdentity({ subject: "bob" })
			.query(api.nutritionLibrary.getMany, {
				ids: ["manual"],
			}),
	).toEqual([]);
});

it("keeps an uploaded photo readable in diary history and rejects another account's photo", async () => {
	const t = convexTest(schema, modules);
	const storageId = await t.run((ctx) =>
		ctx.storage.store(new Blob(["photo"], { type: "image/jpeg" })),
	);
	const alice = t.withIdentity({ subject: "alice" });
	await alice.mutation(api.nutritionFoodPhotos.registerUpload, {
		storageId,
		expectedSubject: "alice",
	});
	const operation = {
		kind: "create" as const,
		entry: {
			clientEntryId: "photo-entry",
			date: "2026-10-13",
			meal: "lunch" as const,
			name: { en: "Soup", nl: "Soep" },
			serving: { en: "Bowl", nl: "Kom" },
			quantity: 1,
			amount: 200,
			baseUnit: "g" as const,
			provenance: { source: "oneOff" as const },
			visual: { kind: "photo" as const, uri: "", storageId },
			nutrients: {
				energy: { kind: "value" as const, amount: 100 },
				protein: { kind: "absent" as const },
				carbs: { kind: "absent" as const },
				fat: { kind: "absent" as const },
				saturatedFat: { kind: "absent" as const },
				fibre: { kind: "absent" as const },
				sugars: { kind: "absent" as const },
				salt: { kind: "absent" as const },
			},
		},
	};
	await alice.mutation(api.nutritionDiary.applyOperation, {
		operationId: "save-diary-photo",
		expectedSubject: "alice",
		operation,
	});
	const fresh = await alice.query(api.nutritionDiary.day, {
		date: "2026-10-13",
	});
	expect(fresh.entries[0].visual).toEqual({
		kind: "photo",
		storageId,
		uri: await photoUrl(t, storageId),
	});
	await expect(
		t
			.withIdentity({ subject: "bob" })
			.mutation(api.nutritionDiary.applyOperation, {
				operationId: "steal-diary-photo",
				expectedSubject: "bob",
				operation,
			}),
	).rejects.toMatchObject({ data: { code: "notFound", field: "storageId" } });
	expect(
		(
			await t
				.withIdentity({ subject: "bob" })
				.query(api.nutritionDiary.day, { date: "2026-10-13" })
		).entries,
	).toEqual([]);
});
