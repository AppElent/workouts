/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

it("makes an uploaded food photo retrievable by its account after a new client signs in", async () => {
	const t = convexTest(schema, modules);
	const storageId = await t.run((ctx) =>
		ctx.storage.store(new Blob(["photo"], { type: "image/jpeg" })),
	);
	const alice = t.withIdentity({ subject: "alice" });
	await alice.mutation(api.nutritionFoodPhotos.registerUpload, {
		storageId,
		expectedSubject: "alice",
	});
	expect(
		await t
			.withIdentity({ subject: "alice" })
			.query(api.nutritionFoodPhotos.url, { storageId }),
	).toBeTruthy();
	expect(
		await t
			.withIdentity({ subject: "bob" })
			.query(api.nutritionFoodPhotos.url, { storageId }),
	).toBeNull();
	await expect(
		t
			.withIdentity({ subject: "bob" })
			.mutation(api.nutritionFoodPhotos.registerUpload, {
				storageId,
				expectedSubject: "bob",
			}),
	).rejects.toThrow("another account");
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
		version: 1,
		operationId: "save-photo",
		expectedSubject: "alice",
		operation: {
			kind: "upsert",
			record: { id: "manual", kind: "food", schemaVersion: 3, payload },
			expectedRevision: 0,
		},
	});
	const fresh = await t
		.withIdentity({ subject: "alice" })
		.query(api.nutritionLibrary.getMany, { ids: ["manual"], photoVersion: 3 });
	const visual = JSON.parse(fresh[0].payload!).visual;
	expect(visual.storageId).toBe(storageId);
	expect(visual.uri).toBe(
		await alice.query(api.nutritionFoodPhotos.url, { storageId }),
	);
	await expect(
		t.withIdentity({ subject: "bob" }).mutation(api.nutritionLibrary.save, {
			version: 1,
			operationId: "steal-photo",
			expectedSubject: "bob",
			operation: {
				kind: "upsert",
				record: { id: "manual", kind: "food", schemaVersion: 3, payload },
				expectedRevision: 0,
			},
		}),
	).rejects.toThrow("another account");
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
		version: 1,
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
		uri: await alice.query(api.nutritionFoodPhotos.url, { storageId }),
	});
	await expect(
		t
			.withIdentity({ subject: "bob" })
			.mutation(api.nutritionDiary.applyOperation, {
				version: 1,
				operationId: "steal-diary-photo",
				expectedSubject: "bob",
				operation,
			}),
	).rejects.toThrow("another account");
});

it("replaces old OFF image copies in the library and diary with provider references without changing nutrition", async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity({ subject: "alice" });
	const uri = "https://images.openfoodfacts.org/images/products/123/front.jpg";
	const nutrients = {
		energy: { kind: "value" as const, amount: 100 },
		protein: { kind: "absent" as const },
		carbs: { kind: "absent" as const },
		fat: { kind: "absent" as const },
		saturatedFat: { kind: "absent" as const },
		fibre: { kind: "absent" as const },
		sugars: { kind: "absent" as const },
		salt: { kind: "absent" as const },
	};
	await alice.mutation(api.nutritionLibrary.save, {
		version: 1,
		expectedSubject: "alice",
		operationId: "old-off",
		operation: {
			kind: "upsert",
			expectedRevision: 0,
			record: {
				id: "off",
				kind: "food",
				schemaVersion: 2,
				payload: JSON.stringify({
					id: "off",
					name: { en: "Soup", nl: "Soep" },
					baseUnit: "g",
					nutrients,
					servings: [],
					provenance: {
						recordOrigin: "import",
						nutritionSource: "openfoodfacts",
						locallyEdited: false,
						imageUrl: uri,
						barcode: "123",
					},
					createdAt: 1,
					updatedAt: 1,
				}),
			},
		},
	});
	await alice.mutation(api.nutritionDiary.log, {
		date: "2026-10-13",
		meal: "lunch",
		name: { en: "Soup", nl: "Soep" },
		serving: { en: "Bowl", nl: "Kom" },
		quantity: 1,
		amount: 200,
		baseUnit: "g",
		nutrients,
		provenance: {
			source: "import",
			sourceId: "off",
			nutritionSource: "openfoodfacts",
			locallyEdited: false,
		},
		visual: { kind: "photo", uri: "file:///cached-off.jpg" },
	});
	for (const table of ["library", "diary"] as const)
		await t.mutation(internal.nutritionFoodPhotos.useProviderImages, {
			expectedSubject: "alice",
			table,
			paginationOpts: { cursor: null, numItems: 100 },
		});
	const library = await alice.query(api.nutritionLibrary.getMany, {
		ids: ["off"],
		photoVersion: 3,
	});
	expect(JSON.parse(library[0].payload!).visual).toEqual({
		kind: "remote",
		uri,
	});
	const day = await alice.query(api.nutritionDiary.day, { date: "2026-10-13" });
	expect(day.entries[0].visual).toEqual({ kind: "remote", uri });
	expect(day.entries[0].nutrients).toEqual(nutrients);
	const bob = await t
		.withIdentity({ subject: "bob" })
		.mutation(internal.nutritionFoodPhotos.useProviderImages, {
			expectedSubject: "bob",
			table: "diary",
			paginationOpts: { cursor: null, numItems: 100 },
		});
	expect(bob.changed).toBe(0);
});
