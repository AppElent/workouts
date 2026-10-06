import { useForm, useStore } from "@tanstack/react-form";
import {
	correctDiaryNutrients,
	forkShippedFood,
	getShippedFood,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	type PersonalFoodDraft,
} from "@workouts/core/nutrition";
import { router, Stack, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/build/react-navigation/core";
import { useEffect, useRef, useState } from "react";
import { Pressable } from "react-native";
import { z } from "zod";
import type { DiaryEntry, MealSlot } from "../../../data/nutrition-day";
import {
	snapshotFromDiaryEntry,
	useNutritionOperations,
} from "../../../data/nutrition-operation-service";
import { usePersonalFoods } from "../../../data/personal-foods";
import { useSupplementaryServings } from "../../../data/supplementary-servings";
import { useI18n } from "../../../i18n";
import { useTokens } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { FormScreen, FormSection, FormTextField } from "../../../ui/form";
import { AppText } from "../../../ui/text";

const nutrientInput = z.string().refine((value) => {
	const v = value.trim();
	return (
		!v ||
		v === "~" ||
		(/^\d*(?:[.,]\d+)?$/.test(v) &&
			Number.isFinite(Number(v.replace(",", "."))) &&
			Number(v.replace(",", ".")) >= 0)
	);
});
function inputValue(value: NutrientValue) {
	return value.kind === "value"
		? String(value.amount)
		: value.kind === "trace"
			? "~"
			: "";
}
function parseValue(value: string): NutrientValue {
	const v = value.trim();
	return !v
		? { kind: "absent" }
		: v === "~"
			? { kind: "trace" }
			: { kind: "value", amount: Number(v.replace(",", ".")) };
}

export function DiaryEntryCorrectionScreen({
	entry,
	date,
	meal,
	nutrient,
}: {
	entry: DiaryEntry;
	date: string;
	meal: MealSlot;
	nutrient: NutrientKey;
}) {
	const { t, locale } = useI18n();
	const colors = useTokens();
	const foods = usePersonalFoods();
	const operations = useNutritionOperations();
	const confirm = useConfirm();
	const navigation = useNavigation();
	const [subject] = useState(() => operations.getSubject());
	const shippedId =
		entry.provenance.source === "shipped"
			? entry.provenance.sourceId
			: undefined;
	const additions = useSupplementaryServings(shippedId);
	const [source] = useState(() => {
		if (shippedId) {
			const fork = foods.findForkOf(shippedId);
			if (fork) return fork;
			const shipped = getShippedFood(shippedId);
			return shipped ? forkShippedFood(shipped) : undefined;
		}
		return entry.provenance.source === "oneOff"
			? undefined
			: foods.find(entry.provenance.sourceId);
	});
	const baseUnit = source?.baseUnit ?? entry.baseUnit;
	const basisAmount = source
		? baseUnit === "serving"
			? 1
			: 100
		: entry.amount;
	const [initial] = useState(
		() =>
			Object.fromEntries(
				NUTRIENT_KEYS.map((n) => [
					n,
					inputValue((source?.nutrients ?? entry.nutrients)[n]),
				]),
			) as Record<NutrientKey, string>,
	);
	const [error, setError] = useState<string>();
	const [sourceSaved, setSourceSaved] = useState(false);
	const [leaving, setLeaving] = useState(false);
	const [busy, setBusy] = useState(false);
	const lock = useRef(false);
	const pendingNavigation = useRef<(() => void) | null>(null);
	useEffect(() => {
		if (leaving) {
			if (pendingNavigation.current) pendingNavigation.current();
			else router.back();
		}
	}, [leaving]);
	const mismatch = source !== undefined && source.baseUnit !== entry.baseUnit;
	const failure =
		locale === "nl"
			? "Opslaan mislukt. Je wijzigingen staan er nog; probeer opnieuw."
			: "Could not save. Your changes are still here; try again.";
	const form = useForm({
		defaultValues: { nutrients: initial, convertedAmount: "" },
		onSubmit: ({ value }) => {
			if (
				lock.current ||
				!NUTRIENT_KEYS.every(
					(n) => nutrientInput.safeParse(value.nutrients[n]).success,
				)
			)
				return;
			const changed: Partial<Record<NutrientKey, NutrientValue>> = {};
			for (const n of NUTRIENT_KEYS)
				if (
					value.nutrients[n] !== initial[n] ||
					(n === nutrient &&
						entry.nutrients[n].kind === "absent" &&
						initial[n] !== "")
				)
					changed[n] = parseValue(value.nutrients[n]);
			if (!Object.keys(changed).length) return;
			lock.current = true;
			setBusy(true);
			setError(undefined);
			try {
				if (!subject || operations.getSubject() !== subject)
					throw new Error("Account changed");
				const converted = Number(value.convertedAmount.replace(",", "."));
				if (mismatch && (!Number.isFinite(converted) || converted <= 0))
					throw new Error("Conversion required");
				// A correction carries the explicit historical amount basis, not stale totals.
				const patch = mismatch
					? Object.fromEntries(
							Object.entries(changed).map(([key, v]) => [
								key,
								v.kind === "value"
									? {
											kind: "value" as const,
											amount: (v.amount * converted) / basisAmount,
										}
									: v,
							]),
						)
					: changed;
				const correction = {
					baseUnit: entry.baseUnit,
					basisAmount: mismatch ? entry.amount : basisAmount,
					nutrients: patch,
				};
				correctDiaryNutrients(entry, correction);
				if (source) {
					const latest = shippedId
						? foods.findForkOf(shippedId)
						: "id" in source
							? foods.find(source.id)
							: undefined;
					if (!shippedId && !latest) throw new Error("Food is unavailable");
					const current = latest ?? source;
					if (current.baseUnit !== source.baseUnit)
						throw new Error("Food unit changed");
					const draft: PersonalFoodDraft = {
						...current,
						nutrients: { ...current.nutrients, ...changed },
						provenance: { ...current.provenance, locallyEdited: true },
						servings: latest
							? latest.servings
							: [
									...source.servings,
									...additions.servings
										.filter((s) => s.unit === baseUnit)
										.map((s) => ({
											label: { en: s.name, nl: s.name },
											amount: s.amount,
										})),
								],
					};
					if (latest) foods.update(latest.id, draft);
					else foods.create(draft);
					setSourceSaved(true);
				}
				operations.update(
					subject,
					entry.id.startsWith("client:")
						? { kind: "clientEntryId", id: entry.id.slice(7) }
						: { kind: "serverId", id: entry.id },
					{ correction },
					{
						targetEntry: {
							_id: entry.id,
							...snapshotFromDiaryEntry(entry, date, meal),
						},
					},
					() => {
						lock.current = false;
						setBusy(false);
						setError(failure);
					},
					() => {
						setBusy(false);
						setLeaving(true);
					},
				);
			} catch {
				lock.current = false;
				setBusy(false);
				setError(failure);
			}
		},
	});
	const values = useStore(form.store, (s) => s.values);
	const dirty = NUTRIENT_KEYS.some(
		(n) =>
			values.nutrients[n] !== initial[n] ||
			(n === nutrient &&
				entry.nutrients[n].kind === "absent" &&
				initial[n] !== ""),
	);
	const valid =
		NUTRIENT_KEYS.every(
			(n) => nutrientInput.safeParse(values.nutrients[n]).success,
		) &&
		(!mismatch ||
			(Number(values.convertedAmount.replace(",", ".")) > 0 &&
				Number.isFinite(Number(values.convertedAmount.replace(",", ".")))));
	usePreventRemove((dirty || busy) && !leaving, ({ data }) => {
		if (busy) return;
		void confirm({
			title: t.diaryEntry.discardTitle,
			message: sourceSaved
				? locale === "nl"
					? "Het voedingsmiddel is al opgeslagen. De correctie in het dagboek is nog niet opgeslagen."
					: "The Food is already saved. The diary correction has not been saved."
				: t.diaryEntry.discardBody,
			confirmLabel: t.diaryEntry.discard,
			cancelLabel: t.diaryEntry.keepEditing,
			destructive: true,
		}).then((ok) => {
			if (ok) {
				pendingNavigation.current = () => navigation.dispatch(data.action);
				setLeaving(true);
			}
		});
	});
	const saveLabel = locale === "nl" ? "Correctie opslaan" : "Save correction";
	const disabled =
		!dirty || !valid || busy || (Boolean(shippedId) && additions.loading);
	return (
		<>
			<Stack.Screen
				options={{
					title:
						locale === "nl" ? "Voedingswaarden aanvullen" : "Fill in nutrition",
					gestureEnabled: !busy,
					headerLeft: () => (
						<Pressable
							accessibilityRole="button"
							onPress={() => router.back()}
							disabled={busy}
							style={{ minHeight: 48, justifyContent: "center" }}
						>
							<AppText>{t.diaryEntry.cancel}</AppText>
						</Pressable>
					),
					unstable_headerRightItems: () => [
						{
							type: "button",
							label: saveLabel,
							accessibilityLabel: saveLabel,
							icon: { type: "sfSymbol", name: "checkmark" },
							variant: dirty ? "prominent" : "plain",
							tintColor: colors.accentFill,
							disabled,
							onPress: () => void form.handleSubmit(),
						},
					],
				}}
			/>
			<FormScreen
				nativeSheet
				primaryAction={{
					label: saveLabel,
					onPress: () => void form.handleSubmit(),
					disabled,
					loading: busy,
				}}
			>
				<AppText variant="heading">{entry.name[locale]}</AppText>
				<AppText>
					{source
						? locale === "nl"
							? "Wijzigt het voedingsmiddel en alleen dit dagboekitem. Andere invoer blijft gelijk."
							: "Updates the Food and only this diary entry. Other entries stay unchanged."
						: locale === "nl"
							? "Geen beschikbaar voedingsmiddel. Je wijzigt alleen dit dagboekitem."
							: "No source Food is available. You are changing only this diary entry."}
				</AppText>
				{shippedId && !foods.findForkOf(shippedId) ? (
					<AppText variant="caption">
						{locale === "nl"
							? "Er wordt een persoonlijke versie van dit voedingsmiddel opgeslagen."
							: "A personal version of this shipped Food will be saved."}
					</AppText>
				) : null}
				<AppText variant="label">
					{locale === "nl" ? "Waarden voor" : "Values for"} {basisAmount}{" "}
					{baseUnit}
				</AppText>
				<AppText variant="caption">
					{locale === "nl"
						? "Leeg = onbekend · ~ = spoor · 0 = nul"
						: "Blank = unknown · ~ = trace · 0 = zero"}
				</AppText>
				{mismatch ? (
					<form.Field name="convertedAmount">
						{(field) => (
							<FormTextField
								label={
									locale === "nl"
										? `Deze invoer (${entry.amount} ${entry.baseUnit}) komt overeen met hoeveel ${baseUnit}?`
										: `How many ${baseUnit} equal this entry (${entry.amount} ${entry.baseUnit})?`
								}
								value={field.state.value}
								onChangeText={field.handleChange}
								keyboardType="decimal-pad"
							/>
						)}
					</form.Field>
				) : null}
				<FormSection>
					{[nutrient, ...NUTRIENT_KEYS.filter((n) => n !== nutrient)].map(
						(n) => (
							<form.Field key={n} name={`nutrients.${n}`}>
								{(field) => (
									<FormTextField
										editable={!busy}
										label={`${t.nutrition.nutrients[n]} (${n === "energy" ? "kcal" : "g"})`}
										value={field.state.value}
										onChangeText={field.handleChange}
										keyboardType="numbers-and-punctuation"
										error={
											!nutrientInput.safeParse(field.state.value).success
												? locale === "nl"
													? "Vul een geldig, niet-negatief getal in."
													: "Enter a valid, nonnegative number."
												: undefined
										}
									/>
								)}
							</form.Field>
						),
					)}
				</FormSection>
				{sourceSaved && error ? (
					<AppText accessibilityRole="alert">
						{locale === "nl"
							? "Voedingsmiddel opgeslagen; dagboekcorrectie mislukt. Probeer opnieuw."
							: "Food saved; diary correction failed. Try again."}
					</AppText>
				) : null}
				{error ? (
					<AppText accessibilityRole="alert" style={{ color: colors.danger }}>
						{error}
					</AppText>
				) : null}
			</FormScreen>
		</>
	);
}
