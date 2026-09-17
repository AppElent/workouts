import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import { createNutritionCookingRepository } from "./nutrition-cooking-repository";

describe("nutrition cooking SQLite repository", () => {
	it("keeps drafts isolated by account and durable across reopen", () => {
		const path = join(
			tmpdir(),
			`workouts-cooking-${Date.now()}-${Math.random()}.db`,
		);
		try {
			const first = new SQLiteTestDatabase(path);
			const repo = createNutritionCookingRepository(first, {
				mintId: (() => {
					let count = 0;
					return () => `id-${++count}`;
				})(),
				now: () => 10,
			});
			const draft = repo.createDraft("account-a", {
				date: "2026-09-12",
				meal: "dinner",
				note: "Restaurant noodles",
			});
			repo.createDraft("account-b", {
				date: "2026-09-12",
				meal: "dinner",
				note: "B's note",
			});
			expect(repo.listDrafts("account-b")).toHaveLength(1);
			expect(repo.getDraft("account-b", draft.id)).toBeUndefined();
			repo.close();

			const reopenedDatabase = new SQLiteTestDatabase(path);
			const reopened = createNutritionCookingRepository(reopenedDatabase);
			expect(reopened.listDrafts("account-a")).toMatchObject([
				{ id: draft.id, note: "Restaurant noodles", meal: "dinner" },
			]);
			reopened.close();
		} finally {
			try {
				unlinkSync(path);
			} catch {
				// The test database may already have been cleaned up by the adapter.
			}
		}
	});

	it("stores conversion identity before local diary acceptance and makes it idempotent", () => {
		const database = new SQLiteTestDatabase();
		const repo = createNutritionCookingRepository(database, {
			mintId: () => "unused",
		});
		const draft = repo.createDraft("account-a", {
			date: "2026-09-12",
			meal: "lunch",
			note: "Finish this later",
		});
		const marked = repo.beginDraftConversion(
			"account-a",
			draft.id,
			"client-entry-1",
		);
		expect(marked.conversionClientEntryId).toBe("client-entry-1");
		expect(
			repo.beginDraftConversion("account-a", draft.id, "a-different-client"),
		).toEqual(marked);
		const withOperation = repo.setDraftConversionOperation(
			"account-a",
			draft.id,
			"operation-1",
		);
		expect(withOperation).toMatchObject({
			conversionClientEntryId: "client-entry-1",
			conversionOperationId: "operation-1",
		});
		expect(repo.clearDraftConversion("account-a", draft.id)).toMatchObject({
			id: draft.id,
		});
		expect(repo.getDraft("account-a", draft.id)).not.toMatchObject({
			conversionClientEntryId: expect.any(String),
		});
	});

	it("deletes only the requested account's draft", () => {
		const database = new SQLiteTestDatabase();
		const repo = createNutritionCookingRepository(database, {
			mintId: (() => {
				let i = 0;
				return () => `draft-${++i}`;
			})(),
		});
		const a = repo.createDraft("a", {
			date: "2026-09-12",
			meal: "breakfast",
			note: "A",
		});
		const b = repo.createDraft("b", {
			date: "2026-09-12",
			meal: "breakfast",
			note: "B",
		});
		expect(repo.removeDraft("a", b.id)).toBe(false);
		expect(repo.removeDraft("a", a.id)).toBe(true);
		expect(repo.getDraft("b", b.id)?.note).toBe("B");
	});
});
