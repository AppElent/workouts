import {
	forkHasLocalEdits,
	forkSource,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	type FoodPhotoCropPosition,
	type FoodPhotoManager,
	type FoodPhotoSource,
	foodPhotos,
} from "../../../data/food-photo-manager";
import {
	type FoodVisual,
	type PersonalFood,
	type PersonalFoodDraft,
	validatePersonalFoodDraft,
} from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { useI18n } from "../../../i18n";
import { personalFoodEditorCopy } from "../../../screens/personal-food-editor-copy";
import { useToast } from "../../../ui/toast";

export type NutrientInput = { kind: NutrientValue["kind"]; amount: string };
export type ServingInput = {
	key: string;
	en: string;
	nl: string;
	amount: string;
};
export type EditorVisual =
	| FoodVisual
	| { readonly kind: "remote"; readonly uri: string };

function toText(value: number) {
	return String(value).replace(".", ",");
}

export function parseFoodNumber(text: string): number {
	return Number(text.trim().replace(",", "."));
}

function initialNutrients(seed?: PersonalFoodDraft) {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => {
			const value = seed?.nutrients[key] ?? { kind: "absent" as const };
			return [
				key,
				{
					kind: value.kind,
					amount: value.kind === "value" ? toText(value.amount) : "",
				},
			];
		}),
	) as Record<NutrientKey, NutrientInput>;
}

function initialServings(seed?: PersonalFoodDraft): ServingInput[] {
	return (
		seed?.servings.map((serving, index) => ({
			key: `existing-${index}`,
			en: serving.label.en,
			nl: serving.label.nl,
			amount: toText(serving.amount),
		})) ?? []
	);
}

/**
 * Everything the Personal Food editor edits, as a local draft. Nothing is
 * written until `save`; `dirty` drives ✓ and the discard confirmation.
 */
export function usePersonalFoodDraft({
	food,
	seed,
	defaultClassification,
	initialName,
	photoManager = foodPhotos,
	onSaved,
}: {
	/** A new food's name, such as the search term it was created from. */
	initialName?: string;
	food?: PersonalFood;
	seed?: PersonalFoodDraft;
	defaultClassification: "ordinary" | "recipe";
	photoManager?: FoodPhotoManager;
	onSaved: (saved: PersonalFood) => void;
}) {
	const { t, locale } = useI18n();
	const copy = personalFoodEditorCopy[locale];
	const personalFoods = usePersonalFoods();
	const toast = useToast();
	const initial = food ?? seed;
	const [visual, setVisual] = useState<EditorVisual | undefined>(() =>
		initial?.visual
			? initial.visual
			: initial?.provenance.imageUrl && (!food || food.visualMigrationPending)
				? { kind: "remote", uri: initial.provenance.imageUrl }
				: undefined,
	);
	const [visualError, setVisualError] = useState<string>();
	const [photoBusy, setPhotoBusy] = useState(false);
	const [remoteCrop, setRemoteCrop] = useState<FoodPhotoCropPosition>("center");
	const stagedPhoto = useRef<string | undefined>(undefined);
	const savedPhoto = useRef(false);
	const [name, setNameState] = useState(
		initial?.name[locale] ?? initialName ?? "",
	);
	const [nameError, setNameError] = useState<string>();
	const [baseUnit, setBaseUnit] = useState<"g" | "ml">(
		initial?.baseUnit === "ml" ? "ml" : "g",
	);
	const [classification, setClassification] = useState<"ordinary" | "recipe">(
		initial?.classification ?? defaultClassification,
	);
	const [estimated, setEstimated] = useState(initial?.estimated ?? false);
	const [basisKind, setBasisKind] = useState<"per100" | "perServing">(
		initial?.nutritionBasis?.kind ?? "per100",
	);
	const servingLabel =
		initial?.nutritionBasis?.kind === "perServing"
			? initial.nutritionBasis.label[locale]
			: copy.serving;
	const [description, setDescription] = useState(
		initial?.description?.[locale] ?? "",
	);
	const [nutrients, setNutrients] = useState(() => initialNutrients(initial));
	const [servings, setServings] = useState(() => initialServings(initial));
	const nextServingKey = useRef(servings.length);
	const [saving, setSaving] = useState(false);
	const saveLock = useRef(false);
	const [touched, setTouched] = useState(false);
	const touch = () => setTouched(true);

	useEffect(
		() => () => {
			if (!savedPhoto.current && stagedPhoto.current)
				photoManager.remove({ kind: "photo", uri: stagedPhoto.current });
		},
		[photoManager],
	);

	const source = useMemo(
		() => (initial ? forkSource(initial) : undefined),
		[initial],
	);

	function buildDraft(): PersonalFoodDraft {
		const values = {} as Record<NutrientKey, NutrientValue>;
		for (const key of NUTRIENT_KEYS) {
			const input = nutrients[key];
			values[key] =
				input.kind === "value"
					? { kind: "value", amount: parseFoodNumber(input.amount) }
					: { kind: input.kind };
		}
		const bilingual = (text: string, previous?: { en: string; nl: string }) =>
			locale === "en"
				? { en: text, nl: previous?.nl ?? text }
				: { en: previous?.en ?? text, nl: text };
		const editable = {
			// One name, used in both languages: the editor asks for it once.
			name: { en: name, nl: name },
			baseUnit: basisKind === "perServing" ? ("serving" as const) : baseUnit,
			classification,
			estimated,
			nutritionBasis:
				basisKind === "perServing"
					? {
							kind: "perServing" as const,
							label:
								initial?.nutritionBasis?.kind === "perServing"
									? initial.nutritionBasis.label
									: { en: servingLabel, nl: servingLabel },
						}
					: { kind: "per100" as const, unit: baseUnit },
			...(description.trim()
				? { description: bilingual(description, initial?.description) }
				: {}),
			nutrients: values,
			servings:
				basisKind === "perServing"
					? []
					: servings.map((serving) => ({
							label: { en: serving.en, nl: serving.nl },
							amount: parseFoodNumber(serving.amount),
						})),
		};
		let provenance = initial?.provenance ?? {
			recordOrigin: "personal" as const,
			nutritionSource: "manual" as const,
			locallyEdited: false,
		};
		if (source)
			provenance = {
				...provenance,
				locallyEdited:
					editable.baseUnit === "serving" ||
					forkHasLocalEdits({ ...editable, baseUnit: baseUnit }, source),
			};
		else if (initial && touched)
			provenance = { ...provenance, locallyEdited: true };
		const storedVisual = visual?.kind === "remote" ? undefined : visual;
		return {
			...editable,
			provenance,
			...(storedVisual ? { visual: storedVisual } : {}),
		};
	}

	function replaceVisual(next: EditorVisual | undefined) {
		if (
			stagedPhoto.current &&
			(next?.kind !== "photo" || next.uri !== stagedPhoto.current)
		) {
			photoManager.remove({ kind: "photo", uri: stagedPhoto.current });
			stagedPhoto.current = undefined;
		}
		setVisual(next);
		setVisualError(undefined);
		touch();
	}

	async function choosePhoto(from: FoodPhotoSource) {
		if (photoBusy) return;
		setPhotoBusy(true);
		setVisualError(undefined);
		try {
			const choice = await photoManager.choose(from);
			if (choice.kind === "denied") setVisualError(copy.photoPermissionDenied);
			else if (choice.kind === "selected") {
				replaceVisual(choice.visual);
				stagedPhoto.current = choice.visual.uri;
			}
		} catch {
			setVisualError(copy.photoFailure);
		} finally {
			setPhotoBusy(false);
		}
	}

	/** Returns false when the draft is not valid; the caller scrolls to the name. */
	async function save(): Promise<boolean> {
		if (saving || saveLock.current) return true;
		setNameError(undefined);
		if (!name.trim() || name.trim().length > 500) {
			setNameError(name.trim() ? copy.nameTooLong : copy.nameRequired);
			return false;
		}
		let draft: PersonalFoodDraft;
		try {
			draft = validatePersonalFoodDraft(buildDraft());
		} catch {
			toast.error(t.nutrition.personalFood.validation);
			return false;
		}
		saveLock.current = true;
		setSaving(true);
		await Promise.resolve();
		let importedPhoto: FoodVisual | undefined;
		let saved: PersonalFood | undefined;
		try {
			if (visual?.kind === "remote") {
				try {
					importedPhoto = await photoManager.importRemote(
						visual.uri,
						remoteCrop,
					);
					draft = { ...draft, visual: importedPhoto };
				} catch {
					toast.error(copy.importPhotoFailure);
				}
			}
			saved = food
				? personalFoods.update(food.id, draft)
				: personalFoods.create(draft);
			if (
				food?.visual?.kind === "photo" &&
				(saved.visual?.kind !== "photo" || food.visual.uri !== saved.visual.uri)
			)
				photoManager.remove(food.visual);
			savedPhoto.current = true;
		} catch {
			if (importedPhoto) photoManager.remove(importedPhoto);
			toast.error(t.nutrition.personalFood.saveFailure);
		} finally {
			saveLock.current = false;
			setSaving(false);
		}
		if (saved) {
			setTouched(false);
			onSaved(saved);
		}
		return true;
	}

	function discardStagedPhoto() {
		if (stagedPhoto.current) {
			photoManager.remove({ kind: "photo", uri: stagedPhoto.current });
			stagedPhoto.current = undefined;
		}
	}

	return {
		food,
		initial,
		source,
		visual,
		visualError,
		photoBusy,
		remoteCrop,
		setRemoteCrop: (crop: FoodPhotoCropPosition) => {
			setRemoteCrop(crop);
			touch();
		},
		name,
		nameError,
		setName: (next: string) => {
			setNameState(next);
			setNameError(undefined);
			touch();
		},
		baseUnit,
		classification,
		setClassification: (next: "ordinary" | "recipe") => {
			setClassification(next);
			touch();
		},
		estimated,
		setEstimated: (next: boolean) => {
			setEstimated(next);
			touch();
		},
		basisKind,
		servingLabel,
		setBasis: (kind: "per100" | "perServing", unit: "g" | "ml" = baseUnit) => {
			setBasisKind(kind);
			setBaseUnit(unit);
			touch();
		},
		description,
		setDescription: (next: string) => {
			setDescription(next);
			touch();
		},
		nutrients,
		setNutrient: (key: NutrientKey, input: NutrientInput) => {
			setNutrients((current) => ({ ...current, [key]: input }));
			touch();
		},
		servings,
		upsertServing: (
			index: number | undefined,
			label: string,
			amount: string,
		) => {
			setServings((current) => {
				if (index === undefined) {
					nextServingKey.current += 1;
					return [
						...current,
						{
							key: `new-${nextServingKey.current}`,
							en: label,
							nl: label,
							amount,
						},
					];
				}
				return current.map((serving, at) =>
					at === index
						? locale === "en"
							? { ...serving, en: label, amount }
							: { ...serving, nl: label, amount }
						: serving,
				);
			});
			touch();
		},
		removeServing: (index: number) => {
			setServings((current) => current.filter((_, at) => at !== index));
			touch();
		},
		moveServingToTop: (index: number) => {
			setServings((current) => [
				current[index],
				...current.filter((_, at) => at !== index),
			]);
			touch();
		},
		dirty: touched,
		saving,
		choosePhoto,
		replaceVisual,
		save,
		discardStagedPhoto,
		buildDraft,
	};
}

export type PersonalFoodDraftState = ReturnType<typeof usePersonalFoodDraft>;
