import type { NutritionDiaryPartSnapshot } from "@workouts/core";
import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";
import { openDatabaseSync } from "expo-sqlite";
import { mintNutritionUuid } from "./nutrition-operation-service";
import type { SyncSQLiteDatabase } from "./personal-food-repository";

export const NUTRITION_COOKING_DATABASE_NAME = "workouts-nutrition-cooking.db";
const DATABASE_VERSION = 1;

export type CookingBilingual = { readonly en: string; readonly nl: string };

export type CookingYield =
	| { readonly kind: "grams"; readonly amount: number }
	| { readonly kind: "portions"; readonly amount: number };

/** Frozen at recipe-save time so edits to a Personal Food never rewrite a recipe. */
export type CookingIngredientSnapshot = NutritionDiaryPartSnapshot & {
	readonly ingredientId: string;
	readonly sourceKey: string;
	readonly name: CookingBilingual;
	readonly serving: CookingBilingual;
	readonly quantity: number;
	readonly amount: number;
	readonly baseUnit: "g" | "ml";
	readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
};

export type CookingRecipeDraft = {
	readonly name: CookingBilingual;
	readonly versionName: CookingBilingual;
	readonly ingredients: readonly CookingIngredientSnapshot[];
	readonly yield: CookingYield;
};

export type CookingRecipe = CookingRecipeDraft & {
	readonly id: string;
	readonly subject: string;
	readonly createdAt: number;
	readonly updatedAt: number;
};

export type CaptureDraft = {
	readonly id: string;
	readonly subject: string;
	readonly date: string;
	readonly meal: "breakfast" | "lunch" | "dinner" | "snacks";
	readonly note: string;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly conversionClientEntryId?: string;
	readonly conversionOperationId?: string;
};

export type NutritionCookingRepository = {
	listRecipes(subject: string): CookingRecipe[];
	getRecipe(subject: string, id: string): CookingRecipe | undefined;
	createRecipe(subject: string, draft: CookingRecipeDraft): CookingRecipe;
	removeRecipe(subject: string, id: string): boolean;
	listDrafts(subject: string): CaptureDraft[];
	getDraft(subject: string, id: string): CaptureDraft | undefined;
	createDraft(
		subject: string,
		draft: Pick<CaptureDraft, "date" | "meal" | "note">,
	): CaptureDraft;
	updateDraft(
		subject: string,
		id: string,
		draft: Pick<CaptureDraft, "date" | "meal" | "note">,
	): CaptureDraft;
	beginDraftConversion(
		subject: string,
		id: string,
		clientEntryId: string,
	): CaptureDraft;
	setDraftConversionOperation(
		subject: string,
		id: string,
		operationId: string,
	): CaptureDraft;
	clearDraftConversion(subject: string, id: string): CaptureDraft;
	removeDraft(subject: string, id: string): boolean;
	close(): void;
};

type RecipeRow = {
	subject: string;
	id: string;
	name_en: string;
	name_nl: string;
	version_en: string;
	version_nl: string;
	ingredients_json: string;
	yield_json: string;
	created_at: number;
	updated_at: number;
};

type DraftRow = {
	subject: string;
	id: string;
	date: string;
	meal: CaptureDraft["meal"];
	note: string;
	conversion_client_entry_id: string | null;
	conversion_operation_id: string | null;
	created_at: number;
	updated_at: number;
};

function transaction(database: SyncSQLiteDatabase, work: () => void): void {
	database.execSync("BEGIN IMMEDIATE");
	try {
		work();
		database.execSync("COMMIT");
	} catch (error) {
		database.execSync("ROLLBACK");
		throw error;
	}
}

function migrate(database: SyncSQLiteDatabase): void {
	const current =
		database.getFirstSync<{ user_version: number }>("PRAGMA user_version")
			?.user_version ?? 0;
	if (current > DATABASE_VERSION) {
		throw new Error("This cooking database is newer than this app version.");
	}
	if (current === DATABASE_VERSION) return;
	transaction(database, () => {
		if (current < 1) {
			database.execSync(`
				CREATE TABLE IF NOT EXISTS nutrition_cooking_recipes (
					subject TEXT NOT NULL,
					id TEXT NOT NULL,
					name_en TEXT NOT NULL,
					name_nl TEXT NOT NULL,
					version_en TEXT NOT NULL,
					version_nl TEXT NOT NULL,
					ingredients_json TEXT NOT NULL,
					yield_json TEXT NOT NULL,
					created_at INTEGER NOT NULL,
					updated_at INTEGER NOT NULL,
					PRIMARY KEY (subject, id)
				);
				CREATE INDEX IF NOT EXISTS nutrition_cooking_recipes_by_updated
					ON nutrition_cooking_recipes(subject, updated_at DESC, id ASC);
				CREATE TABLE IF NOT EXISTS nutrition_capture_drafts (
					subject TEXT NOT NULL,
					id TEXT NOT NULL,
					date TEXT NOT NULL,
					meal TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snacks')),
					note TEXT NOT NULL,
					conversion_client_entry_id TEXT,
					conversion_operation_id TEXT,
					created_at INTEGER NOT NULL,
					updated_at INTEGER NOT NULL,
					PRIMARY KEY (subject, id)
				);
				CREATE INDEX IF NOT EXISTS nutrition_capture_drafts_by_date
					ON nutrition_capture_drafts(subject, date ASC, created_at ASC, id ASC);
			`);
		}
		database.execSync(`PRAGMA user_version = ${DATABASE_VERSION}`);
	});
}

function text(value: unknown, label: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${label} is required.`);
	}
	return value.trim();
}

function positive(value: unknown, label: string): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		throw new Error(`${label} must be greater than zero.`);
	}
	return value;
}

function validateNutrient(value: unknown, key: NutrientKey): NutrientValue {
	if (!value || typeof value !== "object" || !("kind" in value)) {
		throw new Error(`${key} must have a nutrient state.`);
	}
	const candidate = value as { kind?: unknown; amount?: unknown };
	if (candidate.kind === "absent") return { kind: "absent" };
	if (candidate.kind === "trace") return { kind: "trace" };
	if (
		candidate.kind !== "value" ||
		typeof candidate.amount !== "number" ||
		!Number.isFinite(candidate.amount) ||
		candidate.amount < 0
	) {
		throw new Error(`${key} must have a valid nutrient state.`);
	}
	return { kind: "value", amount: candidate.amount };
}

function validateIngredient(
	ingredient: CookingIngredientSnapshot,
	index: number,
): CookingIngredientSnapshot {
	const nutrients = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS)
		nutrients[key] = validateNutrient(ingredient.nutrients[key], key);
	if (ingredient.baseUnit !== "g" && ingredient.baseUnit !== "ml") {
		throw new Error(
			`Ingredient ${index + 1} unit must be grams or millilitres.`,
		);
	}
	return {
		...ingredient,
		ingredientId: text(ingredient.ingredientId, `Ingredient ${index + 1} id`),
		sourceKey: text(ingredient.sourceKey, `Ingredient ${index + 1} source`),
		name: {
			en: text(ingredient.name.en, `Ingredient ${index + 1} English name`),
			nl: text(ingredient.name.nl, `Ingredient ${index + 1} Dutch name`),
		},
		serving: {
			en: text(
				ingredient.serving.en,
				`Ingredient ${index + 1} English serving`,
			),
			nl: text(ingredient.serving.nl, `Ingredient ${index + 1} Dutch serving`),
		},
		quantity: positive(ingredient.quantity, `Ingredient ${index + 1} quantity`),
		amount: positive(ingredient.amount, `Ingredient ${index + 1} amount`),
		baseUnit: ingredient.baseUnit,
		nutrients,
	};
}

function validateRecipe(draft: CookingRecipeDraft): CookingRecipeDraft {
	const ingredients = draft.ingredients.map(validateIngredient);
	if (!ingredients.length)
		throw new Error("A recipe needs at least one ingredient.");
	if (draft.yield.kind !== "grams" && draft.yield.kind !== "portions") {
		throw new Error("Recipe yield must be grams or portions.");
	}
	return {
		name: {
			en: text(draft.name.en, "Recipe English name"),
			nl: text(draft.name.nl, "Recipe Dutch name"),
		},
		versionName: {
			en: text(draft.versionName.en, "Recipe English version name"),
			nl: text(draft.versionName.nl, "Recipe Dutch version name"),
		},
		ingredients,
		yield: {
			kind: draft.yield.kind,
			amount: positive(draft.yield.amount, "Recipe yield"),
		},
	};
}

function recipeFromRow(row: RecipeRow): CookingRecipe {
	const draft = validateRecipe({
		name: { en: row.name_en, nl: row.name_nl },
		versionName: { en: row.version_en, nl: row.version_nl },
		ingredients: JSON.parse(row.ingredients_json),
		yield: JSON.parse(row.yield_json),
	});
	return {
		...draft,
		id: row.id,
		subject: row.subject,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function draftFromRow(row: DraftRow): CaptureDraft {
	return {
		subject: row.subject,
		id: row.id,
		date: row.date,
		meal: row.meal,
		note: row.note,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		...(row.conversion_client_entry_id
			? { conversionClientEntryId: row.conversion_client_entry_id }
			: {}),
		...(row.conversion_operation_id
			? { conversionOperationId: row.conversion_operation_id }
			: {}),
	};
}

export function createNutritionCookingRepository(
	database: SyncSQLiteDatabase,
	options: { readonly now?: () => number; readonly mintId?: () => string } = {},
): NutritionCookingRepository {
	migrate(database);
	const now = options.now ?? Date.now;
	const nextId = options.mintId ?? mintNutritionUuid;

	function getRecipe(subject: string, id: string): CookingRecipe | undefined {
		const row = database.getFirstSync<RecipeRow>(
			"SELECT * FROM nutrition_cooking_recipes WHERE subject = ? AND id = ?",
			subject,
			id,
		);
		return row ? recipeFromRow(row) : undefined;
	}

	function getDraft(subject: string, id: string): CaptureDraft | undefined {
		const row = database.getFirstSync<DraftRow>(
			"SELECT * FROM nutrition_capture_drafts WHERE subject = ? AND id = ?",
			subject,
			id,
		);
		return row ? draftFromRow(row) : undefined;
	}

	return {
		listRecipes(subject) {
			return database
				.getAllSync<RecipeRow>(
					"SELECT * FROM nutrition_cooking_recipes WHERE subject = ? ORDER BY updated_at DESC, id ASC",
					subject,
				)
				.map(recipeFromRow);
		},
		getRecipe,
		createRecipe(subject, draft) {
			const valid = validateRecipe(draft);
			const timestamp = now();
			const id = nextId();
			transaction(database, () => {
				database.runSync(
					`INSERT INTO nutrition_cooking_recipes
					 (subject, id, name_en, name_nl, version_en, version_nl, ingredients_json, yield_json, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					subject,
					id,
					valid.name.en,
					valid.name.nl,
					valid.versionName.en,
					valid.versionName.nl,
					JSON.stringify(valid.ingredients),
					JSON.stringify(valid.yield),
					timestamp,
					timestamp,
				);
			});
			const recipe = getRecipe(subject, id);
			if (!recipe) throw new Error("Recipe was not saved.");
			return recipe;
		},
		removeRecipe(subject, id) {
			return (
				database.runSync(
					"DELETE FROM nutrition_cooking_recipes WHERE subject = ? AND id = ?",
					subject,
					id,
				).changes > 0
			);
		},
		listDrafts(subject) {
			return database
				.getAllSync<DraftRow>(
					"SELECT * FROM nutrition_capture_drafts WHERE subject = ? ORDER BY date DESC, created_at ASC, id ASC",
					subject,
				)
				.map(draftFromRow);
		},
		getDraft,
		createDraft(subject, draft) {
			const date = text(draft.date, "Draft date");
			const note = text(draft.note, "Draft note");
			if (!["breakfast", "lunch", "dinner", "snacks"].includes(draft.meal)) {
				throw new Error("Draft meal is invalid.");
			}
			const timestamp = now();
			const id = nextId();
			database.runSync(
				`INSERT INTO nutrition_capture_drafts(subject, id, date, meal, note, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				subject,
				id,
				date,
				draft.meal,
				note,
				timestamp,
				timestamp,
			);
			const created = getDraft(subject, id);
			if (!created) throw new Error("Draft was not saved.");
			return created;
		},
		updateDraft(subject, id, draft) {
			const date = text(draft.date, "Draft date");
			const note = text(draft.note, "Draft note");
			if (!["breakfast", "lunch", "dinner", "snacks"].includes(draft.meal)) {
				throw new Error("Draft meal is invalid.");
			}
			database.runSync(
				"UPDATE nutrition_capture_drafts SET date = ?, meal = ?, note = ?, updated_at = ? WHERE subject = ? AND id = ?",
				date,
				draft.meal,
				note,
				now(),
				subject,
				id,
			);
			const updated = getDraft(subject, id);
			if (!updated) throw new Error("Draft was not found.");
			return updated;
		},
		beginDraftConversion(subject, id, clientEntryId) {
			text(clientEntryId, "Conversion client entry id");
			const existing = getDraft(subject, id);
			if (!existing) throw new Error("Draft was not found.");
			if (existing.conversionClientEntryId) return existing;
			database.runSync(
				"UPDATE nutrition_capture_drafts SET conversion_client_entry_id = ?, updated_at = ? WHERE subject = ? AND id = ?",
				clientEntryId,
				now(),
				subject,
				id,
			);
			const marked = getDraft(subject, id);
			if (!marked) throw new Error("Draft conversion could not be prepared.");
			return marked;
		},
		setDraftConversionOperation(subject, id, operationId) {
			text(operationId, "Conversion operation id");
			database.runSync(
				"UPDATE nutrition_capture_drafts SET conversion_operation_id = ?, updated_at = ? WHERE subject = ? AND id = ?",
				operationId,
				now(),
				subject,
				id,
			);
			const updated = getDraft(subject, id);
			if (!updated) throw new Error("Draft was not found.");
			return updated;
		},
		clearDraftConversion(subject, id) {
			database.runSync(
				"UPDATE nutrition_capture_drafts SET conversion_client_entry_id = NULL, conversion_operation_id = NULL, updated_at = ? WHERE subject = ? AND id = ?",
				now(),
				subject,
				id,
			);
			const updated = getDraft(subject, id);
			if (!updated) throw new Error("Draft was not found.");
			return updated;
		},
		removeDraft(subject, id) {
			return (
				database.runSync(
					"DELETE FROM nutrition_capture_drafts WHERE subject = ? AND id = ?",
					subject,
					id,
				).changes > 0
			);
		},
		close() {
			(
				database as SyncSQLiteDatabase & { closeSync?: () => void }
			).closeSync?.();
		},
	};
}

export function openNutritionCookingRepository(
	idFactory: () => string = mintNutritionUuid,
): NutritionCookingRepository {
	return createNutritionCookingRepository(
		openDatabaseSync(NUTRITION_COOKING_DATABASE_NAME) as SyncSQLiteDatabase,
		{ mintId: idFactory },
	);
}
