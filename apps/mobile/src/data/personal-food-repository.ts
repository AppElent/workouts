import {
	getShippedFood,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	type ShippedFoodId,
} from "@workouts/core/nutrition";
import { openDatabaseSync } from "expo-sqlite";

export const PERSONAL_FOOD_DATABASE_NAME = "workouts-nutrition.db";
const DATABASE_VERSION = 2;

export type SQLiteValue = string | number | null | Uint8Array;

/** The synchronous subset shared by expo-sqlite and the real SQLite test adapter. */
export type SyncSQLiteDatabase = {
	execSync(source: string): void;
	runSync(
		source: string,
		...params: SQLiteValue[]
	): { changes: number; lastInsertRowId: number };
	getFirstSync<T>(source: string, ...params: SQLiteValue[]): T | null;
	getAllSync<T>(source: string, ...params: SQLiteValue[]): T[];
};

export type PersonalServing = {
	readonly label: { readonly en: string; readonly nl: string };
	/** Positive amount in the Personal Food's base unit. */
	readonly amount: number;
};

/**
 * Provenance fields are stored together so #75 and #76 can retain a shipped
 * ancestor or provider attribution without another SQLite migration.
 */
export type PersonalFoodProvenance = {
	readonly recordOrigin: "personal" | "import";
	readonly nutritionSource: "manual" | "nevo" | "openfoodfacts";
	readonly locallyEdited: boolean;
	readonly forkedFrom?: ShippedFoodId;
	readonly provider?: string;
	readonly barcode?: string;
	readonly attribution?: string;
};

export type PersonalFoodDraft = {
	readonly name: { readonly en: string; readonly nl: string };
	readonly baseUnit: "g" | "ml";
	readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	readonly servings: readonly PersonalServing[];
	readonly provenance: PersonalFoodProvenance;
};

export type PersonalFood = PersonalFoodDraft & {
	readonly id: string;
	readonly createdAt: number;
	readonly updatedAt: number;
};

export type ComboSnapshotProvenance =
	| {
			readonly source: "shipped";
			readonly sourceId: string;
			readonly dataset: string;
			readonly edition: string;
			readonly sourceCode: number;
			readonly sourceName: { readonly en: string; readonly nl: string };
			readonly saltDerived: boolean;
	  }
	| {
			readonly source: "personal" | "import";
			readonly sourceId: string;
			readonly nutritionSource: "manual" | "nevo" | "openfoodfacts";
			readonly locallyEdited: boolean;
			readonly forkedFrom?: string;
			readonly provider?: string;
			readonly barcode?: string;
			readonly attribution?: string;
	  }
	| { readonly source: "oneOff" };

/** A date- and meal-free diary snapshot saved as one fixed Combo part. */
export type ComboPartSnapshot = {
	readonly name: { readonly en: string; readonly nl: string };
	readonly serving: { readonly en: string; readonly nl: string };
	readonly quantity: number;
	readonly amount: number;
	readonly baseUnit: "g" | "ml";
	readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	readonly provenance: ComboSnapshotProvenance;
};

export type ComboPartReference =
	| { readonly kind: "shipped"; readonly foodId: string }
	| { readonly kind: "personal"; readonly foodId: string }
	| { readonly kind: "oneOff" };

export type ComboPartDraft = {
	readonly id?: string;
	readonly reference: ComboPartReference;
	readonly snapshot: ComboPartSnapshot;
};

export type ComboDraft = {
	readonly name: string;
	readonly parts: readonly ComboPartDraft[];
};

export type ComboPart = Omit<ComboPartDraft, "id"> & {
	readonly id: string;
	readonly status: "available" | "missing";
};

export type Combo = Omit<ComboDraft, "parts"> & {
	readonly id: string;
	readonly parts: readonly ComboPart[];
	readonly createdAt: number;
	readonly updatedAt: number;
};

export type PersonalFoodRepository = {
	list(): PersonalFood[];
	find(id: string): PersonalFood | undefined;
	search(query: string, locale: "en" | "nl"): PersonalFood[];
	create(draft: PersonalFoodDraft): PersonalFood;
	update(id: string, draft: PersonalFoodDraft): PersonalFood;
	remove(id: string): boolean;
	listCombos(): Combo[];
	findCombo(id: string): Combo | undefined;
	createCombo(draft: ComboDraft): Combo;
	updateCombo(id: string, draft: ComboDraft): Combo;
	removeCombo(id: string): boolean;
};

type PersonalFoodRow = {
	id: string;
	name_en: string;
	name_nl: string;
	base_unit: string;
	nutrients_json: string;
	servings_json: string;
	provenance_json: string;
	created_at: number;
	updated_at: number;
};

type ComboRow = {
	id: string;
	name: string;
	parts_json: string;
	created_at: number;
	updated_at: number;
};

type RepositoryOptions = {
	readonly mintUuid?: () => string;
	readonly now?: () => number;
};

function migrate(database: SyncSQLiteDatabase): void {
	const current =
		database.getFirstSync<{ user_version: number }>("PRAGMA user_version")
			?.user_version ?? 0;
	if (current > DATABASE_VERSION) {
		throw new Error(
			`This nutrition database is newer than this version of Workouts (${current}).`,
		);
	}
	if (current === DATABASE_VERSION) return;

	database.execSync("BEGIN IMMEDIATE");
	try {
		if (current < 1) {
			database.execSync(`
				CREATE TABLE IF NOT EXISTS personal_foods (
					id TEXT PRIMARY KEY NOT NULL,
					name_en TEXT NOT NULL,
					name_nl TEXT NOT NULL,
					base_unit TEXT NOT NULL CHECK (base_unit IN ('g', 'ml')),
					nutrients_json TEXT NOT NULL,
					servings_json TEXT NOT NULL,
					provenance_json TEXT NOT NULL,
					created_at INTEGER NOT NULL,
					updated_at INTEGER NOT NULL
				);
				CREATE INDEX IF NOT EXISTS personal_foods_by_updated
					ON personal_foods(updated_at DESC);
			`);
		}
		if (current < 2) {
			database.execSync(`
				CREATE TABLE IF NOT EXISTS nutrition_combos (
					id TEXT PRIMARY KEY NOT NULL,
					name TEXT NOT NULL,
					parts_json TEXT NOT NULL,
					created_at INTEGER NOT NULL,
					updated_at INTEGER NOT NULL
				);
				CREATE INDEX IF NOT EXISTS nutrition_combos_by_updated
					ON nutrition_combos(updated_at DESC);
			`);
		}
		database.execSync(`PRAGMA user_version = ${DATABASE_VERSION}`);
		database.execSync("COMMIT");
	} catch (error) {
		database.execSync("ROLLBACK");
		throw error;
	}
}

function validateText(value: unknown, label: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${label} is required.`);
	}
	return value.trim();
}

function validateNutrient(value: unknown, label: string): NutrientValue {
	if (!value || typeof value !== "object" || !("kind" in value)) {
		throw new Error(`${label} must have a nutrient state.`);
	}
	if (value.kind === "absent") return { kind: "absent" };
	if (value.kind === "trace") return { kind: "trace" };
	if (value.kind !== "value" || !("amount" in value)) {
		throw new Error(`${label} must have a nutrient state.`);
	}
	if (
		typeof value.amount !== "number" ||
		!Number.isFinite(value.amount) ||
		value.amount < 0
	) {
		throw new Error(`${label} must be zero or greater.`);
	}
	return { kind: "value", amount: value.amount };
}

function validateProvenance(value: unknown): PersonalFoodProvenance {
	if (!value || typeof value !== "object") {
		throw new Error("Food provenance is required.");
	}
	const candidate = value as Partial<PersonalFoodProvenance>;
	if (
		candidate.recordOrigin !== "personal" &&
		candidate.recordOrigin !== "import"
	) {
		throw new Error("Food provenance has an invalid record origin.");
	}
	if (
		candidate.nutritionSource !== "manual" &&
		candidate.nutritionSource !== "nevo" &&
		candidate.nutritionSource !== "openfoodfacts"
	) {
		throw new Error("Food provenance has an invalid nutrition source.");
	}
	if (typeof candidate.locallyEdited !== "boolean") {
		throw new Error("Food provenance must say whether it was edited locally.");
	}
	return {
		recordOrigin: candidate.recordOrigin,
		nutritionSource: candidate.nutritionSource,
		locallyEdited: candidate.locallyEdited,
		...(candidate.forkedFrom ? { forkedFrom: candidate.forkedFrom } : {}),
		...(candidate.provider ? { provider: candidate.provider } : {}),
		...(candidate.barcode ? { barcode: candidate.barcode } : {}),
		...(candidate.attribution ? { attribution: candidate.attribution } : {}),
	};
}

export function validatePersonalFoodDraft(
	draft: PersonalFoodDraft,
): PersonalFoodDraft {
	if (draft.baseUnit !== "g" && draft.baseUnit !== "ml") {
		throw new Error("Base unit must be grams or millilitres.");
	}
	if (!Array.isArray(draft.servings) || draft.servings.length > 3) {
		throw new Error("A Personal Food can have up to three Servings.");
	}
	const nutrients = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS) {
		nutrients[key] = validateNutrient(draft.nutrients[key], key);
	}
	const servings = draft.servings.map((serving, index) => {
		if (!Number.isFinite(serving.amount) || serving.amount <= 0) {
			throw new Error(`Serving ${index + 1} amount must be greater than zero.`);
		}
		return {
			label: {
				en: validateText(
					serving.label.en,
					`Serving ${index + 1} English label`,
				),
				nl: validateText(serving.label.nl, `Serving ${index + 1} Dutch label`),
			},
			amount: serving.amount,
		};
	});
	return {
		name: {
			en: validateText(draft.name.en, "English name"),
			nl: validateText(draft.name.nl, "Dutch name"),
		},
		baseUnit: draft.baseUnit,
		nutrients,
		servings,
		provenance: validateProvenance(draft.provenance),
	};
}

function validateComboProvenance(
	value: unknown,
	reference: ComboPartReference,
): ComboSnapshotProvenance {
	if (!value || typeof value !== "object" || !("source" in value)) {
		throw new Error("Combo part provenance is required.");
	}
	const candidate = value as ComboSnapshotProvenance;
	if (reference.kind === "oneOff") {
		if (candidate.source !== "oneOff") {
			throw new Error("A one-off Combo part must keep one-off provenance.");
		}
		return { source: "oneOff" };
	}
	if (candidate.source === "oneOff" || !("sourceId" in candidate)) {
		throw new Error("A referenced Combo part must keep its source id.");
	}
	if (candidate.sourceId !== reference.foodId) {
		throw new Error("A Combo reference must match its saved snapshot.");
	}
	if (reference.kind === "shipped") {
		if (candidate.source !== "shipped") {
			throw new Error("A shipped Combo part must keep shipped provenance.");
		}
		if (!Number.isFinite(candidate.sourceCode)) {
			throw new Error("A shipped Combo part needs a source code.");
		}
		if (typeof candidate.saltDerived !== "boolean") {
			throw new Error("A shipped Combo part must preserve salt provenance.");
		}
		return {
			source: "shipped",
			sourceId: candidate.sourceId,
			dataset: validateText(candidate.dataset, "Dataset"),
			edition: validateText(candidate.edition, "Dataset edition"),
			sourceCode: candidate.sourceCode,
			sourceName: {
				en: validateText(candidate.sourceName.en, "English source name"),
				nl: validateText(candidate.sourceName.nl, "Dutch source name"),
			},
			saltDerived: candidate.saltDerived,
		};
	}
	if (candidate.source !== "personal" && candidate.source !== "import") {
		throw new Error("A Personal Food Combo part has invalid provenance.");
	}
	if (
		candidate.nutritionSource !== "manual" &&
		candidate.nutritionSource !== "nevo" &&
		candidate.nutritionSource !== "openfoodfacts"
	) {
		throw new Error(
			"A Personal Food Combo part has an invalid nutrition source.",
		);
	}
	if (typeof candidate.locallyEdited !== "boolean") {
		throw new Error("A Personal Food Combo part must preserve its edit state.");
	}
	return {
		source: candidate.source,
		sourceId: candidate.sourceId,
		nutritionSource: candidate.nutritionSource,
		locallyEdited: candidate.locallyEdited,
		...(candidate.forkedFrom ? { forkedFrom: candidate.forkedFrom } : {}),
		...(candidate.provider ? { provider: candidate.provider } : {}),
		...(candidate.barcode ? { barcode: candidate.barcode } : {}),
		...(candidate.attribution ? { attribution: candidate.attribution } : {}),
	};
}

function validateComboDraft(draft: ComboDraft): ComboDraft {
	const name = validateText(draft.name, "Combo name");
	if (!Array.isArray(draft.parts) || draft.parts.length === 0) {
		throw new Error("A Combo needs at least one part.");
	}
	const parts = draft.parts.map((part, index) => {
		if (!part || typeof part !== "object" || !("reference" in part)) {
			throw new Error(`Combo part ${index + 1} is invalid.`);
		}
		const reference = (part as ComboPartDraft).reference as
			| ComboPartReference
			| { kind?: string };
		if (reference?.kind === "combo") {
			throw new Error("A Combo cannot contain another Combo.");
		}
		if (
			reference?.kind !== "shipped" &&
			reference?.kind !== "personal" &&
			reference?.kind !== "oneOff"
		) {
			throw new Error(`Combo part ${index + 1} has an invalid reference.`);
		}
		let typedReference: ComboPartReference;
		if (reference.kind === "oneOff") {
			typedReference = { kind: "oneOff" };
		} else {
			if (!("foodId" in reference)) {
				throw new Error(`Combo part ${index + 1} needs a source id.`);
			}
			typedReference = {
				kind: reference.kind,
				foodId: validateText(reference.foodId, "Combo source id"),
			};
		}
		const snapshot = (part as ComboPartDraft).snapshot;
		if (!snapshot || typeof snapshot !== "object") {
			throw new Error(`Combo part ${index + 1} needs a snapshot.`);
		}
		if (!(snapshot.quantity > 0) || !(snapshot.amount > 0)) {
			throw new Error("Combo part quantities must be greater than zero.");
		}
		if (snapshot.baseUnit !== "g" && snapshot.baseUnit !== "ml") {
			throw new Error("Combo part base unit must be grams or millilitres.");
		}
		const nutrients = {} as Record<NutrientKey, NutrientValue>;
		for (const key of NUTRIENT_KEYS) {
			nutrients[key] = validateNutrient(snapshot.nutrients[key], key);
		}
		return {
			...(part.id ? { id: validateText(part.id, "Combo part id") } : {}),
			reference: typedReference,
			snapshot: {
				name: {
					en: validateText(snapshot.name.en, "English Combo part name"),
					nl: validateText(snapshot.name.nl, "Dutch Combo part name"),
				},
				serving: {
					en: validateText(snapshot.serving.en, "English serving"),
					nl: validateText(snapshot.serving.nl, "Dutch serving"),
				},
				quantity: snapshot.quantity,
				amount: snapshot.amount,
				baseUnit: snapshot.baseUnit,
				nutrients,
				provenance: validateComboProvenance(
					snapshot.provenance,
					typedReference,
				),
			},
		};
	});
	return { name, parts };
}

function rowToFood(row: PersonalFoodRow): PersonalFood {
	const draft = validatePersonalFoodDraft({
		name: { en: row.name_en, nl: row.name_nl },
		baseUnit: row.base_unit as "g" | "ml",
		nutrients: JSON.parse(row.nutrients_json),
		servings: JSON.parse(row.servings_json),
		provenance: JSON.parse(row.provenance_json),
	});
	return {
		id: row.id,
		...draft,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function mintUuid(): string {
	const bytes = new Uint8Array(16);
	if (globalThis.crypto?.getRandomValues) {
		globalThis.crypto.getRandomValues(bytes);
	} else {
		for (let index = 0; index < bytes.length; index += 1) {
			bytes[index] = Math.floor(Math.random() * 256);
		}
	}
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
	return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function createPersonalFoodRepository(
	database: SyncSQLiteDatabase,
	options: RepositoryOptions = {},
): PersonalFoodRepository {
	migrate(database);
	const nextUuid = options.mintUuid ?? mintUuid;
	const now = options.now ?? Date.now;

	function find(id: string): PersonalFood | undefined {
		const row = database.getFirstSync<PersonalFoodRow>(
			"SELECT * FROM personal_foods WHERE id = ?",
			id,
		);
		return row ? rowToFood(row) : undefined;
	}

	function comboFromRow(row: ComboRow): Combo {
		const valid = validateComboDraft({
			name: row.name,
			parts: JSON.parse(row.parts_json),
		});
		return {
			id: row.id,
			name: valid.name,
			parts: valid.parts.map((part) => {
				if (!part.id) throw new Error("A stored Combo part has no stable id.");
				const status =
					part.reference.kind === "oneOff" ||
					(part.reference.kind === "shipped" &&
						getShippedFood(part.reference.foodId) !== undefined) ||
					(part.reference.kind === "personal" &&
						find(part.reference.foodId) !== undefined)
						? "available"
						: "missing";
				return { ...part, id: part.id, status };
			}),
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	function findCombo(id: string): Combo | undefined {
		const row = database.getFirstSync<ComboRow>(
			"SELECT * FROM nutrition_combos WHERE id = ?",
			id,
		);
		return row ? comboFromRow(row) : undefined;
	}

	function storedComboParts(draft: ComboDraft): ComboPartDraft[] {
		return validateComboDraft(draft).parts.map((part) => ({
			...part,
			id: part.id ?? nextUuid(),
		}));
	}

	return {
		list() {
			return database
				.getAllSync<PersonalFoodRow>(
					"SELECT * FROM personal_foods ORDER BY updated_at DESC, id ASC",
				)
				.map(rowToFood);
		},
		find,
		search(query, locale) {
			const needle = query.trim().toLocaleLowerCase(locale);
			if (needle.length === 0) return this.list();
			return this.list()
				.filter((food) =>
					[food.name[locale], food.name[locale === "en" ? "nl" : "en"]].some(
						(name) => name.toLocaleLowerCase(locale).includes(needle),
					),
				)
				.sort((left, right) =>
					left.name[locale].localeCompare(right.name[locale], locale),
				);
		},
		create(draft) {
			const valid = validatePersonalFoodDraft(draft);
			const id = nextUuid();
			const timestamp = now();
			database.runSync(
				`INSERT INTO personal_foods
					(id, name_en, name_nl, base_unit, nutrients_json, servings_json, provenance_json, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				id,
				valid.name.en,
				valid.name.nl,
				valid.baseUnit,
				JSON.stringify(valid.nutrients),
				JSON.stringify(valid.servings),
				JSON.stringify(valid.provenance),
				timestamp,
				timestamp,
			);
			return {
				id,
				...valid,
				createdAt: timestamp,
				updatedAt: timestamp,
			};
		},
		update(id, draft) {
			const existing = find(id);
			if (!existing) throw new Error("Personal Food not found.");
			const valid = validatePersonalFoodDraft(draft);
			const timestamp = now();
			database.runSync(
				`UPDATE personal_foods
				 SET name_en = ?, name_nl = ?, base_unit = ?, nutrients_json = ?,
				     servings_json = ?, provenance_json = ?, updated_at = ?
				 WHERE id = ?`,
				valid.name.en,
				valid.name.nl,
				valid.baseUnit,
				JSON.stringify(valid.nutrients),
				JSON.stringify(valid.servings),
				JSON.stringify(valid.provenance),
				timestamp,
				id,
			);
			return {
				id,
				...valid,
				createdAt: existing.createdAt,
				updatedAt: timestamp,
			};
		},
		remove(id) {
			return (
				database.runSync("DELETE FROM personal_foods WHERE id = ?", id)
					.changes > 0
			);
		},
		listCombos() {
			return database
				.getAllSync<ComboRow>(
					"SELECT * FROM nutrition_combos ORDER BY updated_at DESC, id ASC",
				)
				.map(comboFromRow);
		},
		findCombo,
		createCombo(draft) {
			const name = validateText(draft.name, "Combo name");
			const parts = storedComboParts(draft);
			const id = nextUuid();
			const timestamp = now();
			database.runSync(
				`INSERT INTO nutrition_combos
					(id, name, parts_json, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?)`,
				id,
				name,
				JSON.stringify(parts),
				timestamp,
				timestamp,
			);
			const created = findCombo(id);
			if (!created) throw new Error("Combo could not be saved.");
			return created;
		},
		updateCombo(id, draft) {
			const existing = findCombo(id);
			if (!existing) throw new Error("Combo not found.");
			const name = validateText(draft.name, "Combo name");
			const parts = storedComboParts(draft);
			const timestamp = now();
			database.runSync(
				`UPDATE nutrition_combos
				 SET name = ?, parts_json = ?, updated_at = ?
				 WHERE id = ?`,
				name,
				JSON.stringify(parts),
				timestamp,
				id,
			);
			const updated = findCombo(id);
			if (!updated) throw new Error("Combo could not be saved.");
			return updated;
		},
		removeCombo(id) {
			return (
				database.runSync("DELETE FROM nutrition_combos WHERE id = ?", id)
					.changes > 0
			);
		},
	};
}

/** Open the one device database shared by Personal Foods and later local Nutrition data. */
export function openPersonalFoodRepository(): PersonalFoodRepository {
	return createPersonalFoodRepository(
		openDatabaseSync(PERSONAL_FOOD_DATABASE_NAME) as SyncSQLiteDatabase,
	);
}
