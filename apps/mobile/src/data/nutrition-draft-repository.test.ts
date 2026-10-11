import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import { createNutritionCookingRepository } from "./nutrition-cooking-repository";
import { createNutritionDraftRepository } from "./nutrition-draft-repository";

describe("Capture Draft SQLite repository", () => {
	it("cleans only acknowledged, unchanged originals for the selected account", () => {
		const repository = createNutritionDraftRepository(new SQLiteTestDatabase());
		const input = { date: "2026-10-11", meal: "lunch" as const, note: "Soup" };
		const saved = repository.create("alice", input);
		const changed = repository.create("alice", input);
		const pending = repository.create("alice", input);
		const other = repository.create("bob", input);
		for (const draft of [saved, changed, other])
			repository.acknowledgeMigration(draft);
		repository.update("alice", changed.id, { ...input, note: "Updated soup" });
		repository.cleanAcknowledged("alice");
		expect(repository.get("alice", saved.id)).toBeUndefined();
		expect(
			repository
				.pendingMigrations("alice")
				.map((draft) => draft.id)
				.sort(),
		).toEqual([changed.id, pending.id].sort());
		expect(repository.get("bob", other.id)).toEqual(other);
	});
	it("keeps migration originals until acknowledgement and isolates completion by owner", () => {
		const db = new SQLiteTestDatabase();
		const repository = createNutritionDraftRepository(db);
		const draft = repository.create("a", {
			date: "2026-10-07",
			meal: "lunch",
			note: "Legacy",
		});
		expect(repository.pendingMigrations("a")).toEqual([draft]);
		expect(repository.pendingMigrations("b")).toEqual([]);
		const reopened = createNutritionDraftRepository(db);
		expect(reopened.pendingMigrations("a")).toEqual([draft]);
		reopened.acknowledgeMigration(draft);
		expect(reopened.pendingMigrations("a")).toEqual([]);
		expect(reopened.get("a", draft.id)).toEqual(draft);
		reopened.update("a", draft.id, {
			date: draft.date,
			meal: draft.meal,
			note: "Changed original",
		});
		expect(reopened.pendingMigrations("a")).toHaveLength(1);
	});

	it("keeps drafts per account, per day, and durable across reopen", () => {
		const path = join(
			tmpdir(),
			`workouts-drafts-${Date.now()}-${Math.random()}.db`,
		);
		try {
			const repo = createNutritionDraftRepository(new SQLiteTestDatabase(path));
			const noodles = repo.create("account-a", {
				date: "2026-09-15",
				meal: "dinner",
				note: "Restaurant noodles",
			});
			repo.create("account-a", {
				date: "2026-09-16",
				meal: "lunch",
				note: "Wrap from the station",
			});
			repo.create("account-b", {
				date: "2026-09-16",
				meal: "lunch",
				note: "Not mine",
			});

			expect(repo.listForDate("account-a", "2026-09-16")).toMatchObject([
				{ meal: "lunch", note: "Wrap from the station" },
			]);
			expect(repo.listForDate("account-b", "2026-09-15")).toEqual([]);
			expect(repo.get("account-b", noodles.id)).toBeUndefined();
			repo.close();

			const reopened = createNutritionDraftRepository(
				new SQLiteTestDatabase(path),
			);
			expect(reopened.get("account-a", noodles.id)).toMatchObject({
				note: "Restaurant noodles",
				meal: "dinner",
				date: "2026-09-15",
			});
			reopened.close();
		} finally {
			try {
				unlinkSync(path);
			} catch {}
		}
	});

	it("reads drafts written by the older cooking store in the same database", () => {
		const database = new SQLiteTestDatabase();
		const cooking = createNutritionCookingRepository(database);
		database.runSync(
			`INSERT INTO nutrition_capture_drafts(subject, id, date, meal, note, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			"account-a",
			"legacy-1",
			"2026-09-10",
			"snacks",
			"Legacy note",
			1,
			1,
		);
		const drafts = createNutritionDraftRepository(database);
		expect(drafts.listForDate("account-a", "2026-09-10")).toMatchObject([
			{ id: "legacy-1", note: "Legacy note" },
		]);
		cooking.close();
	});

	it("summarises unresolved drafts on other days, oldest first", () => {
		const repo = createNutritionDraftRepository(new SQLiteTestDatabase());
		repo.create("a", { date: "2026-09-16", meal: "lunch", note: "Today" });
		repo.create("a", { date: "2026-09-12", meal: "dinner", note: "Older" });
		repo.create("a", { date: "2026-09-14", meal: "snacks", note: "Old" });
		repo.create("b", { date: "2026-09-01", meal: "lunch", note: "Other" });

		expect(repo.summariseOtherDays("a", "2026-09-16")).toEqual({
			count: 2,
			oldestDate: "2026-09-12",
		});
		expect(repo.summariseOtherDays("a", "2026-09-12")).toEqual({
			count: 2,
			oldestDate: "2026-09-14",
		});
		expect(repo.summariseOtherDays("b", "2026-09-01")).toEqual({
			count: 0,
			oldestDate: undefined,
		});
	});

	it("updates text and meal, and deletes only the requested account's draft", () => {
		let i = 0;
		const repo = createNutritionDraftRepository(new SQLiteTestDatabase(), {
			mintId: () => `draft-${++i}`,
		});
		const a = repo.create("a", {
			date: "2026-09-16",
			meal: "lunch",
			note: "A",
		});
		const b = repo.create("b", {
			date: "2026-09-16",
			meal: "lunch",
			note: "B",
		});

		expect(
			repo.update("a", a.id, { date: a.date, meal: "dinner", note: "A2" }),
		).toMatchObject({ id: "draft-1", meal: "dinner", note: "A2" });
		expect(() =>
			repo.update("a", a.id, { date: a.date, meal: "dinner", note: "  " }),
		).toThrow();
		expect(repo.remove("a", b.id)).toBe(false);
		expect(repo.remove("a", a.id)).toBe(true);
		expect(repo.get("b", b.id)?.note).toBe("B");
	});
});
