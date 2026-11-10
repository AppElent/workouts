import { type MealSlot, NUTRIENT_KEYS, type NutrientKey } from "@foundry/core";
import { useState } from "react";
import type { FoodAuthoringSeed } from "../../../data/food-authoring-intent";
import { oneOffLogSnapshot } from "../../../data/nutrition-one-off";
import { fmt, useI18n } from "../../../i18n";
import { formatNutrientAmount } from "../nutrient-amount";
import { useDiaryWrite } from "../use-diary-write";
import {
	HEADLINE_NUTRIENTS,
	type NutrientInput,
	parseFoodNumber,
} from "../use-nutrient-fields";
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
}: {
	date: string;
	meal: MealSlot;
	/** Name and photo carried over from a Personal food or Recipe form. */
	seed?: FoodAuthoringSeed;
	onLogged: (date: string) => void;
}) {
	const { locale, t } = useI18n();
	const copy = t.nutrition.oneOff;
	const photoCopy = t.nutrition.foodEditor.form;
	const write = useDiaryWrite();
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
										? // At most 2 decimals: readable, and close enough to log.
											String(Number(value.amount.toFixed(2))).replace(".", ",")
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
	const logging = write.busy;
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
						HEADLINE_NUTRIENTS.map((key) => {
							const value = nutrients[key];
							return [
								key,
								value.kind === "value"
									? formatNutrientAmount(key, value.amount, locale)
									: "—",
							];
						}),
					) as Record<(typeof HEADLINE_NUTRIENTS)[number], string>),
				})
			: undefined;

	async function log() {
		if (logging) return;
		const next = {
			name: name.trim() ? undefined : copy.nameRequired,
			amount: amountValid ? undefined : copy.invalidAmount,
			values: nutrients || !amountValid ? undefined : copy.invalidNutrient,
		};
		setErrors(next);
		if (next.name || next.amount || next.values || !nutrients) return;
		const visual =
			photo.visual && photo.visual.kind !== "remote" ? photo.visual : undefined;
		const logged = await write.run(copy.logFailure, (diary) =>
			diary.log(
				oneOffLogSnapshot({
					date: destination.date,
					meal: destination.meal,
					name: { en: name.trim(), nl: name.trim() },
					amount: amountValue,
					baseUnit: unit,
					nutrients,
					...(visual ? { visual } : {}),
				}),
			),
		);
		if (!logged) return;
		photo.keep();
		onLogged(destination.date);
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
