import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MealSlot } from "@foundry/core";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import {
	createFoodShortcutRepository,
	FOOD_SHORTCUT_DATABASE_NAME,
	openFoodShortcutRepository,
	type PortionMemory,
} from "./food-shortcut-repository";

const portion: PortionMemory = {
	kind: "authored",
	servingKey: "slice",
	baseUnit: "g",
	amount: 30,
	quantity: 2,
	label: { en: "Slice", nl: "Sneetje" },
};

it("keeps last-used portions and favorites per account across reopening", () => {
	const directory = mkdtempSync(join(tmpdir(), "food-shortcuts-"));
	const path = join(directory, "state.db");
	try {
		const first = createFoodShortcutRepository(
			new SQLiteTestDatabase(path),
			() => 10,
		);
		first.recordUse("alice", { sourceKey: "apple", portion }, "lunch");
		first.setFavorite("alice", "apple", true);
		first.close();
		const reopened = createFoodShortcutRepository(new SQLiteTestDatabase(path));
		expect(reopened.get("alice", "apple")).toEqual({
			sourceKey: "apple",
			lastUsedAt: 10,
			portion,
			favorite: true,
		});
		expect(reopened.listRecent("bob")).toEqual([]);
		reopened.close();
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

it("lists what was logged to a meal first, then the other recents", () => {
	let clock = 0;
	const store = createFoodShortcutRepository(
		new SQLiteTestDatabase(),
		() => ++clock,
	);
	const log = (sourceKey: string, meal: MealSlot) =>
		store.recordUse("alice", { sourceKey, portion }, meal);
	log("shipped:oats", "breakfast");
	log("shipped:bread", "lunch");
	log("shipped:apple", "lunch");
	const keys = (meal?: MealSlot) =>
		store.listRecent("alice", meal).map((item) => item.sourceKey);
	expect(keys("breakfast")).toEqual([
		"shipped:oats",
		"shipped:apple",
		"shipped:bread",
	]);
	expect(keys("lunch")).toEqual([
		"shipped:apple",
		"shipped:bread",
		"shipped:oats",
	]);
	expect(keys()).toEqual(["shipped:apple", "shipped:bread", "shipped:oats"]);
	store.close();
});

it("clears one account's shortcuts", () => {
	const store = createFoodShortcutRepository(new SQLiteTestDatabase());
	store.recordUse("alice", { sourceKey: "apple", portion }, "lunch");
	store.setFavorite("bob", "apple", true);
	store.clear("alice");
	expect(store.listRecent("alice")).toEqual([]);
	expect(store.listFavorites("bob")).toEqual([
		{ sourceKey: "apple", favorite: true },
	]);
	store.close();
});

it("drops the retired diary cache tables when it migrates", () => {
	const database = new SQLiteTestDatabase();
	database.execSync(
		"CREATE TABLE nutrition_operations(status TEXT); CREATE TABLE nutrition_cached_days(x TEXT); PRAGMA user_version = 6;",
	);
	createFoodShortcutRepository(database);
	expect(
		database.getAllSync<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('nutrition_operations', 'nutrition_cached_days')",
		),
	).toEqual([]);
	database.closeSync();
});

it("opens from memory and leaves the file alone when a newer build already migrated it", () => {
	const directory = mkdtempSync(join(tmpdir(), "food-shortcuts-newer-"));
	try {
		const path = join(directory, FOOD_SHORTCUT_DATABASE_NAME);
		const newer = new SQLiteTestDatabase(path);
		newer.execSync("PRAGMA user_version = 99;");
		newer.closeSync();
		const opened: string[] = [];
		const store = openFoodShortcutRepository((name) => {
			opened.push(name);
			return new SQLiteTestDatabase(name === ":memory:" ? name : path);
		});
		store.setFavorite("alice", "shipped:apple", true);
		expect(store.listFavorites("alice")).toEqual([
			{ sourceKey: "shipped:apple", favorite: true },
		]);
		expect(opened).toEqual([FOOD_SHORTCUT_DATABASE_NAME, ":memory:"]);
		store.close();
		const file = new SQLiteTestDatabase(path);
		expect(
			file.getFirstSync<{ user_version: number }>("PRAGMA user_version"),
		).toEqual({ user_version: 99 });
		file.closeSync();
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
