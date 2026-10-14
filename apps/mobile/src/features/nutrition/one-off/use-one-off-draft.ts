import {
	NUTRIENT_KEYS,
	type NutrientKey,
	roundForDisplay,
} from "@foundry/core/nutrition";
import { useRef, useState } from "react";
import type { FoodAuthoringSeed } from "../../../data/food-authoring-intent";
import type { MealSlot } from "../../../data/nutrition-day";
import { oneOffLogSnapshot } from "../../../data/nutrition-one-off";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../../../data/nutrition-operation-service";
import { fmt, useI18n } from "../../../i18n";
import { type NutrientInput, parseFoodNumber } from "../use-nutrient-fields";
import { useStagedFoodVisual } from "../use-staged-food-visual";
import { type OneOffBasis, oneOffNutrients } from "./one-off-values";

const EMPTY = Object.fromEntries(
	NUTRIENT_KEYS.map((key) => [key, { kind: "absent", amount: "" }]),
) as Record<NutrientKey, NutrientInput>;

/**
 * A one-off entry being written: what was eaten, how much, its values for
 * the whole amount or per 100 g/ml, and where it is logged. It is always
 * estimated and never saved to the library.
 */
export function useOneOffDraft({
	date,
	meal,
	seed,
	onLogged,
	onFailed,
}: {
	date: string;
	meal: MealSlot;
	/** Name and photo carried over from a Personal food or Recipe form. */
	seed?: FoodAuthoringSeed;
	onLogged: (date: string) => void;
	/** Logging failed; the form stays open with its values. */
	onFailed: () => void;
}) {
	const { locale, t } = useI18n();
	const copy = t.nutrition.oneOff;
	const photoCopy = t.nutrition.foodEditor.form;
	const operations = useNutritionOperations();
	const [touched, setTouched] = useState(false);
	const touch = () => setTouched(true);
	const photo = useStagedFoodVisual({
		initial: seed?.visual,
		adoptInitialPhoto: seed?.visual?.kind === "photo",
		messages: {
			permissionDenied: photoCopy.photoPermissionDenied,
			failure: photoCopy.photoFailure,
		},
		onChange: touch,
	});
	const [name, setName] = useState(seed?.name ?? "");
	const [amount, setAmount] = useState("1");
	const [unit, setUnit] = useState<"serving" | "g" | "ml">("serving");
	const [basis, setBasis] = useState<OneOffBasis>("total");
	// Seeded totals (AI entry, "Eén item") fill the values for one portion.
	const [values, setValues] = useState(() =>
		seed?.nutrients
			? (Object.fromEntries(
					NUTRIENT_KEYS.map((key) => {
						const value = seed.nutrients?.[key] ?? { kind: "absent" };
						return [
							key,
							{
								kind: value.kind,
								amount:
									value.kind === "value"
										? // Exact, minus float noise: these strings become the log.
											String(Number(value.amount.toPrecision(12))).replace(
												".",
												",",
											)
										: "",
							},
						];
					}),
				) as Record<NutrientKey, NutrientInput>)
			: EMPTY,
	);
	const [destination, setDestination] = useState({ date, meal });
	const [errors, setErrors] = useState<{
		name?: string;
		amount?: string;
		values?: string;
	}>({});
	const [logging, setLogging] = useState(false);
	const lock = useRef(false);
	const amountValue = parseFoodNumber(amount);
	const amountValid = Number.isFinite(amountValue) && amountValue > 0;
	const anyValue = NUTRIENT_KEYS.some((key) => values[key].kind !== "absent");
	const dirty =
		touched || name !== (seed?.name ?? "") || amount !== "1" || anyValue;
	const nutrients = amountValid
		? oneOffNutrients(values, { basis, amount: amountValue })
		: undefined;
	/** "You ate 350 g, that is: …" under per-100 values. */
	const totals =
		basis === "per100" && nutrients
			? fmt(copy.totals, {
					amount,
					unit: copy.units[unit],
					...(Object.fromEntries(
						(["energy", "protein", "carbs", "fat"] as const).map((key) => {
							const value = nutrients[key];
							return [
								key,
								value.kind === "value"
									? roundForDisplay(key, value.amount).toLocaleString(locale)
									: "—",
							];
						}),
					) as Record<"energy" | "protein" | "carbs" | "fat", string>),
				})
			: undefined;

	function log() {
		if (lock.current) return;
		const next = {
			name: name.trim() ? undefined : copy.nameRequired,
			amount: amountValid ? undefined : copy.invalidAmount,
			values: nutrients || !amountValid ? undefined : copy.invalidNutrient,
		};
		setErrors(next);
		if (next.name || next.amount || next.values || !nutrients) return;
		const subject = operations.getSubject();
		if (!subject) return;
		lock.current = true;
		setLogging(true);
		const fail = () => {
			lock.current = false;
			setLogging(false);
			onFailed();
		};
		try {
			const visual =
				photo.visual && photo.visual.kind !== "remote"
					? photo.visual
					: undefined;
			operations.create(
				subject,
				oneOffLogSnapshot({
					date: destination.date,
					meal: destination.meal,
					name: { en: name.trim(), nl: name.trim() },
					amount: amountValue,
					baseUnit: unit,
					nutrients,
					clientEntryId: mintNutritionUuid(),
					...(visual ? { visual } : {}),
				}),
				undefined,
				fail,
				() => {
					photo.keep();
					lock.current = false;
					setLogging(false);
					onLogged(destination.date);
				},
			);
		} catch {
			fail();
		}
	}

	return {
		name,
		setName: (next: string) => {
			setName(next);
			setErrors((current) => ({ ...current, name: undefined }));
		},
		photo,
		amount,
		setAmount: (next: string) => {
			setAmount(next);
			setErrors((current) => ({ ...current, amount: undefined }));
		},
		unit,
		setUnit: (next: "serving" | "g" | "ml") => {
			setUnit(next);
			// Per 100 only makes sense in grams or millilitres.
			if (next === "serving") setBasis("total");
			touch();
		},
		basis,
		/** Whole amount, or per 100 of a unit, which then becomes the unit. */
		setBasis: (next: OneOffBasis, per?: "g" | "ml") => {
			setBasis(next);
			if (next === "per100" && per) setUnit(per);
			touch();
		},
		values,
		setValue: (key: NutrientKey, input: NutrientInput) => {
			setValues((current) => ({ ...current, [key]: input }));
			setErrors((current) => ({ ...current, values: undefined }));
		},
		destination,
		setMeal: (next: MealSlot) =>
			setDestination((current) => ({ ...current, meal: next })),
		setDate: (next: string) =>
			setDestination((current) => ({ ...current, date: next })),
		totals,
		errors,
		dirty,
		canLog: name.trim().length > 0 && !logging,
		logging,
		log,
		/** Name and photo for a Personal food or Recipe form; it owns the photo. */
		handOff: (): FoodAuthoringSeed => {
			photo.keep();
			// Values travel along only as one portion of a whole-amount entry.
			const portion =
				basis === "total" && unit === "serving" && amountValue === 1
					? nutrients
					: undefined;
			return {
				name,
				...(photo.visual && photo.visual.kind !== "remote"
					? { visual: photo.visual }
					: {}),
				...(portion ? { nutrients: portion } : {}),
			};
		},
	};
}
