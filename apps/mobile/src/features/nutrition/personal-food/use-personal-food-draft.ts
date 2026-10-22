import {
	forkHasLocalEdits,
	forkSource,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@foundry/core/nutrition";
import { useMemo, useRef, useState } from "react";
import type { FoodAuthoringSeed } from "../../../data/food-authoring-intent";
import {
	type FoodPhotoCropPosition,
	type FoodPhotoManager,
	foodPhotos,
} from "../../../data/food-photo-manager";
import { type LabelReading, labelNutrients } from "../../../data/nutrition-ai";
import { replaceProviderMetadata } from "../../../data/open-food-facts-sync";
import {
	type FoodVisual,
	type PersonalFood,
	type PersonalFoodDraft,
	validatePersonalFoodDraft,
} from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { fmt, useI18n } from "../../../i18n";
import { useToast } from "../../../ui/toast";
import { type NutrientInput, parseFoodNumber } from "../use-nutrient-fields";
import { useStagedFoodVisual } from "../use-staged-food-visual";

export type { NutrientInput };
export type ServingInput = {
	key: string;
	en: string;
	nl: string;
	amount: string;
};
export type { EditorVisual } from "../use-staged-food-visual";

function toText(value: number) {
	return String(value).replace(".", ",");
}

export { parseFoodNumber };

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
	const copy = t.nutrition.foodEditor.form;
	const personalFoods = usePersonalFoods();
	const toast = useToast();
	const initial = food ?? seed;
	const [remoteCrop, setRemoteCrop] = useState<FoodPhotoCropPosition>("center");
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
	/**
	 * Provider details from an Open Food Facts refresh, and whether the person
	 * changed anything after it: only their edits make the food locally edited.
	 */
	const [provider, setProvider] = useState<{
		provenance: PersonalFoodDraft["provenance"];
		editedAfter: boolean;
	}>();
	/** Rows a refresh changed, with the value each had before. */
	const [replaced, setReplaced] = useState<
		Partial<Record<NutrientKey, string>>
	>({});
	const touch = () => {
		setTouched(true);
		setProvider((current) => current && { ...current, editedAfter: true });
	};
	const photo = useStagedFoodVisual({
		initial: initial?.visual
			? initial.visual
			: initial?.provenance.imageUrl && (!food || food.visualMigrationPending)
				? { kind: "remote", uri: initial.provenance.imageUrl }
				: undefined,
		photoManager,
		// A new food seeded with a local photo (handed over from a one-off) has
		// not saved it anywhere yet: it is this form's to clean up.
		adoptInitialPhoto: !food && initial?.visual?.kind === "photo",
		messages: {
			permissionDenied: copy.photoPermissionDenied,
			failure: copy.photoFailure,
		},
		onChange: touch,
	});
	const { visual } = photo;
	/** Provider details a scanned label adds; existing ones are kept. */
	const [labelExtras, setLabelExtras] = useState<{
		barcode?: string;
		brand?: string;
		quantity?: string;
	}>({});
	const [fromLabel, setFromLabel] = useState<ReadonlySet<NutrientKey>>(
		() => new Set(),
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
		let provenance = {
			...labelExtras,
			...(provider?.provenance ??
				initial?.provenance ?? {
					recordOrigin: "personal" as const,
					nutritionSource: "manual" as const,
					locallyEdited: false,
				}),
		};
		if (source)
			provenance = {
				...provenance,
				locallyEdited:
					editable.baseUnit === "serving" ||
					forkHasLocalEdits({ ...editable, baseUnit: baseUnit }, source),
			};
		else if (initial && touched)
			provenance = {
				...provenance,
				locallyEdited: provider
					? provider.editedAfter || provider.provenance.locallyEdited
					: true,
			};
		const storedVisual =
			visual?.kind === "remote" && remoteCrop !== "center" ? undefined : visual;
		return {
			...editable,
			provenance,
			...(storedVisual ? { visual: storedVisual } : {}),
		};
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
			if (visual?.kind === "remote" && remoteCrop !== "center") {
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
				? await personalFoods.update(food.id, draft)
				: await personalFoods.create(draft);
			if (
				food?.visual?.kind === "photo" &&
				(saved.visual?.kind !== "photo" || food.visual.uri !== saved.visual.uri)
			)
				photoManager.remove(food.visual);
			photo.keep();
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

	return {
		food,
		initial,
		source,
		visual,
		visualError: photo.error,
		photoBusy: photo.busy,
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
		fromLabel,
		/**
		 * Fill the draft from a scanned label. Only absent values are filled;
		 * a value the person or a provider already entered is never replaced,
		 * and differing ones are reported for the person to decide.
		 */
		applyLabel: (reading: LabelReading, mode: "fill" | "missing") => {
			const label = labelNutrients(reading);
			const filled: NutrientKey[] = [];
			const differences: { key: NutrientKey; label: number }[] = [];
			const next = { ...nutrients };
			for (const key of NUTRIENT_KEYS) {
				const value = label[key];
				if (value.kind !== "value") continue;
				const current = nutrients[key];
				if (current.kind === "absent") {
					next[key] = { kind: "value", amount: toText(value.amount) };
					filled.push(key);
				} else if (current.kind === "value") {
					const existing = parseFoodNumber(current.amount);
					if (
						Math.abs(existing - value.amount) >
						Math.max(0.05, value.amount * 0.03)
					)
						differences.push({ key, label: value.amount });
				}
			}
			setNutrients(next);
			setFromLabel(new Set(filled));
			const wasEmpty = NUTRIENT_KEYS.every(
				(key) => nutrients[key].kind === "absent",
			);
			if (!name.trim()) setNameState(reading.name[locale]);
			if (mode === "fill" && wasEmpty && basisKind === "per100")
				setBaseUnit(reading.basis);
			if (servings.length === 0 && reading.servings.length)
				setServings(
					reading.servings.map((serving, index) => ({
						key: `label-${index}`,
						en: serving.name.en,
						nl: serving.name.nl,
						amount: toText(serving.amount),
					})),
				);
			setLabelExtras({
				...(reading.barcode ? { barcode: reading.barcode } : {}),
				...(reading.brand ? { brand: reading.brand } : {}),
				...(reading.packAmount
					? { quantity: `${toText(reading.packAmount)} ${reading.basis}` }
					: {}),
			});
			touch();
			return { filled, differences };
		},
		replaced,
		/**
		 * Write an Open Food Facts refresh into the draft. `metadataOnly` keeps
		 * the person's values and takes only the provider's details.
		 */
		applyProviderRefresh: (
			latest: PersonalFoodDraft,
			metadataOnly: boolean,
		) => {
			const current = initial?.provenance;
			if (!current) return;
			if (metadataOnly) {
				setProvider({
					provenance: replaceProviderMetadata(current, latest.provenance),
					editedAfter: false,
				});
				setTouched(true);
				return;
			}
			const next = initialNutrients(latest);
			const display = (input: NutrientInput) =>
				input.kind === "value"
					? input.amount
					: input.kind === "trace"
						? copy.trace
						: "—";
			const changed: Partial<Record<NutrientKey, string>> = {};
			for (const key of NUTRIENT_KEYS)
				if (display(nutrients[key]) !== display(next[key]))
					changed[key] = fmt(copy.was, { value: display(nutrients[key]) });
			setNutrients(next);
			setReplaced(changed);
			if (latest.baseUnit !== "serving") {
				setBaseUnit(latest.baseUnit);
				setBasisKind("per100");
			}
			setServings(initialServings(latest));
			setNameState(latest.name[locale]);
			setProvider({
				provenance: { ...latest.provenance, locallyEdited: false },
				editedAfter: false,
			});
			setTouched(true);
		},
		dirty: touched,
		saving,
		choosePhoto: photo.choose,
		replaceVisual: photo.replace,
		save,
		discardStagedPhoto: photo.discard,
		/** Name and photo for another kind of form; it now owns the photo. */
		handOff: (): FoodAuthoringSeed => {
			photo.keep();
			return {
				name,
				...(visual && visual.kind !== "remote" ? { visual } : {}),
			};
		},
		buildDraft,
	};
}

export type PersonalFoodDraftState = ReturnType<typeof usePersonalFoodDraft>;
