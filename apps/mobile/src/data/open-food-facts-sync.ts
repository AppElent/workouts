import { NUTRIENT_KEYS } from "@workouts/core/nutrition";
import type { OffLookupOutcome } from "./open-food-facts";
import type {
	FoodVisual,
	PersonalFood,
	PersonalFoodDraft,
	PersonalFoodProvenance,
} from "./personal-food-repository";

export const OFF_REFRESH_INTERVAL_MS = 4100;

export type OffRefreshProgress = {
	readonly completed: number;
	readonly total: number;
	readonly updated: number;
	readonly unchanged: number;
	readonly failed: number;
};

type RefreshDependencies = {
	readonly foods: readonly PersonalFood[];
	readonly refreshBarcode: (barcode: string) => Promise<OffLookupOutcome>;
	readonly update: (id: string, draft: PersonalFoodDraft) => PersonalFood;
	readonly importPhoto?: (
		url: string,
	) => Promise<Extract<FoodVisual, { kind: "photo" }>>;
	readonly wait?: (milliseconds: number) => Promise<void>;
	readonly onProgress?: (progress: OffRefreshProgress) => void;
	readonly onPhotoFailure?: (food: PersonalFood) => void;
};

const PROVIDER_METADATA_KEYS = [
	"brand",
	"quantity",
	"imageUrl",
	"providerServing",
] as const;

function replaceProviderMetadata(
	current: PersonalFoodProvenance,
	latest: PersonalFoodProvenance,
): PersonalFoodProvenance {
	const next = { ...current };
	for (const key of PROVIDER_METADATA_KEYS) delete next[key];
	for (const key of PROVIDER_METADATA_KEYS) {
		const value = latest[key];
		if (value !== undefined) Object.assign(next, { [key]: value });
	}
	return next;
}

function editableDraft(food: PersonalFood): PersonalFoodDraft {
	return {
		name: food.name,
		baseUnit: food.baseUnit,
		nutrients: food.nutrients,
		servings: food.servings,
		provenance: food.provenance,
		classification: food.classification,
		nutritionBasis: food.nutritionBasis,
		estimated: food.estimated,
		...(food.description ? { description: food.description } : {}),
		...(food.visual ? { visual: food.visual } : {}),
		...(food.visualMigrationPending ? { visualMigrationPending: true } : {}),
	};
}

function refreshedDraft(
	food: PersonalFood,
	latest: PersonalFoodDraft,
): PersonalFoodDraft {
	if (!food.provenance.locallyEdited) {
		return {
			...latest,
			classification: food.classification,
			estimated: food.estimated,
			...(food.description ? { description: food.description } : {}),
			...(food.visual ? { visual: food.visual } : {}),
			...(food.visualMigrationPending ? { visualMigrationPending: true } : {}),
		};
	}
	return {
		...editableDraft(food),
		provenance: replaceProviderMetadata(food.provenance, latest.provenance),
	};
}

function sameDraft(left: PersonalFoodDraft, right: PersonalFoodDraft): boolean {
	return (
		JSON.stringify(left.name) === JSON.stringify(right.name) &&
		left.baseUnit === right.baseUnit &&
		NUTRIENT_KEYS.every(
			(key) =>
				JSON.stringify(left.nutrients[key]) ===
				JSON.stringify(right.nutrients[key]),
		) &&
		JSON.stringify(left.servings) === JSON.stringify(right.servings) &&
		JSON.stringify(left.provenance) === JSON.stringify(right.provenance) &&
		left.classification === right.classification &&
		JSON.stringify(left.nutritionBasis) ===
			JSON.stringify(right.nutritionBasis) &&
		left.estimated === right.estimated &&
		JSON.stringify(left.description) === JSON.stringify(right.description) &&
		JSON.stringify(left.visual) === JSON.stringify(right.visual) &&
		left.visualMigrationPending === right.visualMigrationPending
	);
}

export function openFoodFactsImports(
	foods: readonly PersonalFood[],
): PersonalFood[] {
	return foods.filter(
		(food) =>
			food.provenance.recordOrigin === "import" &&
			food.provenance.nutritionSource === "openfoodfacts" &&
			Boolean(food.provenance.barcode),
	);
}

export async function refreshOpenFoodFactsImports({
	foods,
	refreshBarcode,
	update,
	importPhoto,
	wait = (milliseconds) =>
		new Promise((resolve) => setTimeout(resolve, milliseconds)),
	onProgress,
	onPhotoFailure,
}: RefreshDependencies): Promise<OffRefreshProgress> {
	const imports = openFoodFactsImports(foods);
	let progress: OffRefreshProgress = {
		completed: 0,
		total: imports.length,
		updated: 0,
		unchanged: 0,
		failed: 0,
	};
	onProgress?.(progress);

	for (let index = 0; index < imports.length; index += 1) {
		if (index > 0) await wait(OFF_REFRESH_INTERVAL_MS);
		const food = imports[index];
		let outcome: OffLookupOutcome;
		try {
			outcome = await refreshBarcode(food.provenance.barcode as string);
		} catch {
			outcome = { kind: "network-error" };
		}
		if (outcome.kind === "found") {
			let draft = refreshedDraft(food, outcome.draft);
			const imageUrl = draft.provenance.imageUrl;
			if (
				food.visualMigrationPending &&
				!food.visual &&
				imageUrl &&
				importPhoto
			) {
				try {
					draft = {
						...draft,
						visual: await importPhoto(imageUrl),
						visualMigrationPending: undefined,
					};
				} catch {
					draft = { ...draft, visualMigrationPending: true };
					onPhotoFailure?.(food);
				}
			}
			if (
				sameDraft(editableDraft(food), draft) &&
				!food.visualMigrationPending
			) {
				progress = { ...progress, unchanged: progress.unchanged + 1 };
			} else {
				update(food.id, draft);
				progress = { ...progress, updated: progress.updated + 1 };
			}
		} else if (outcome.kind === "rate-limited") {
			const remaining = imports.length - progress.completed;
			progress = {
				...progress,
				completed: imports.length,
				failed: progress.failed + remaining,
			};
			onProgress?.(progress);
			break;
		} else {
			progress = { ...progress, failed: progress.failed + 1 };
		}
		progress = { ...progress, completed: progress.completed + 1 };
		onProgress?.(progress);
	}
	return progress;
}
