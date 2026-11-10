import {
	correctDiaryNutrients,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	type PersonalFoodDraft,
} from "@foundry/core";
import { forkShippedFood, getShippedFood } from "@foundry/core/shipped-foods";
import { useForm, useStore } from "@tanstack/react-form";
import { router, Stack, useNavigation, usePreventRemove } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable } from "react-native";
import { z } from "zod";
import type { DiaryEntry } from "../../../data/nutrition-day";
import { useNutritionDiary } from "../../../data/nutrition-diary";
import { usePersonalFoods } from "../../../data/personal-foods";
import { useSupplementaryServings } from "../../../data/supplementary-servings";
import { fmt, parseLocalizedDecimal, useI18n } from "../../../i18n";
import { useTokens } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { FormScreen, FormSection, FormTextField } from "../../../ui/form";
import { AppText } from "../../../ui/text";
import { useWriteFailureMessage } from "../../../ui/use-screen-write";

const nutrientInput = z.string().refine((value) => {
	const v = value.trim();
	return (
		!v ||
		v === "~" ||
		(/^\d*(?:[.,]\d+)?$/.test(v) && (parseLocalizedDecimal(v) ?? -1) >= 0)
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
			: { kind: "value", amount: parseLocalizedDecimal(v) ?? Number.NaN };
}

type CorrectionProps = {
	entry: DiaryEntry;
	nutrient: NutrientKey;
};

export function DiaryEntryCorrectionScreen(props: CorrectionProps) {
	const source = props.entry.provenance;
	const foods = usePersonalFoods({
		ids:
			source.source !== "oneOff" && source.source !== "shipped"
				? [source.sourceId]
				: [],
		forkIds: source.source === "shipped" ? [source.sourceId] : [],
	});
	const { t } = useI18n();
	const [loaded, setLoaded] = useState(false);
	useEffect(() => {
		if (!foods.loading) setLoaded(true);
	}, [foods.loading]);
	if (!loaded) return <AppText>{t.nutrition.day.loading}</AppText>;
	return <CorrectionForm {...props} />;
}

function CorrectionForm({ entry, nutrient }: CorrectionProps) {
	const { t, locale } = useI18n();
	const copy = t.diaryEntry.correction;
	const colors = useTokens();
	const foods = usePersonalFoods();
	const diary = useNutritionDiary();
	const confirm = useConfirm();
	const navigation = useNavigation();
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
	const failure = copy.failure;
	const writeFailureMessage = useWriteFailureMessage();
	const form = useForm({
		defaultValues: { nutrients: initial, convertedAmount: "" },
		onSubmit: async ({ value }) => {
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
				const converted =
					parseLocalizedDecimal(value.convertedAmount) ?? Number.NaN;
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
					if (latest) await foods.update(latest.id, draft);
					else await foods.create(draft);
					setSourceSaved(true);
				}
				await diary.update({ kind: "serverId", id: entry.id }, { correction });
				setLeaving(true);
			} catch (error) {
				setError(writeFailureMessage(error, failure));
			} finally {
				lock.current = false;
				setBusy(false);
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
		(!mismatch || (parseLocalizedDecimal(values.convertedAmount) ?? 0) > 0);
	usePreventRemove((dirty || busy) && !leaving, ({ data }) => {
		if (busy) return;
		void confirm({
			title: t.diaryEntry.discardTitle,
			message: sourceSaved ? copy.sourceSavedDiscard : t.diaryEntry.discardBody,
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
	const saveLabel = copy.save;
	const disabled =
		!dirty || !valid || busy || (Boolean(shippedId) && additions.loading);
	return (
		<>
			<Stack.Screen
				options={{
					title: copy.title,
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
				<AppText>{source ? copy.updatesSource : copy.noSource}</AppText>
				{shippedId && !foods.findForkOf(shippedId) ? (
					<AppText variant="caption">{copy.forkNotice}</AppText>
				) : null}
				<AppText variant="label">
					{fmt(copy.valuesFor, { amount: basisAmount, unit: baseUnit })}
				</AppText>
				<AppText variant="caption">{copy.legend}</AppText>
				{mismatch ? (
					<form.Field name="convertedAmount">
						{(field) => (
							<FormTextField
								label={fmt(copy.convertAmount, {
									unit: baseUnit,
									amount: entry.amount,
									entryUnit: entry.baseUnit,
								})}
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
												? copy.invalidNumber
												: undefined
										}
									/>
								)}
							</form.Field>
						),
					)}
				</FormSection>
				{sourceSaved && error ? (
					<AppText accessibilityRole="alert">{copy.sourceSavedFailure}</AppText>
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
