import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { nutritionCookingCopy } from "../data/nutrition-cooking-copy";
import type { MealSlot } from "../data/nutrition-day";
import {
	oneOffLogSnapshot,
	positiveOneOffNumber,
} from "../data/nutrition-one-off";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../data/nutrition-operation-service";
import { useI18n } from "../i18n";
import { colors, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { FormTextField } from "../ui/form";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

type Mode = "hub" | "oneoff-log";

const EMPTY_NUTRIENT_INPUTS = Object.fromEntries(
	NUTRIENT_KEYS.map((key) => [key, ""]),
) as Record<NutrientKey, string>;

export function NutritionCookingScreen({
	date,
	meal,
	initialMode,
}: {
	date: string;
	meal: MealSlot;
	initialMode?: Exclude<Mode, "hub">;
}) {
	const { locale, t } = useI18n();
	const copy = nutritionCookingCopy(locale);
	const operations = useNutritionOperations();
	const toast = useToast();
	const [mode, setMode] = useState<Mode>(() => initialMode ?? "hub");

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
		>
			{mode === "hub" ? (
				<>
					<Eyebrow>{copy.title}</Eyebrow>
					<AppText variant="title">{copy.title}</AppText>
					<Card style={styles.card}>
						<AppText variant="heading">{copy.storageTitle}</AppText>
						<AppText variant="caption">{copy.storageBody}</AppText>
					</Card>
					<PrimaryButton
						label={copy.logOnce}
						onPress={() => setMode("oneoff-log")}
					/>
				</>
			) : (
				<OneOffLogger
					copy={copy}
					locale={locale}
					date={date}
					meal={meal}
					operations={operations}
					labels={t.nutrition.nutrients}
					toast={toast}
					onAccepted={() => setMode("hub")}
					onCancel={() => setMode("hub")}
				/>
			)}
		</ScrollView>
	);
}

function OneOffLogger({
	copy,
	locale,
	date,
	meal,
	operations,
	labels,
	toast,
	onAccepted,
	onCancel,
}: {
	copy: ReturnType<typeof nutritionCookingCopy>;
	locale: "en" | "nl";
	date: string;
	meal: MealSlot;
	operations: ReturnType<typeof useNutritionOperations>;
	labels: Readonly<Record<NutrientKey, string>>;
	toast: { error: (message: string) => void };
	onAccepted: () => void;
	onCancel: () => void;
}) {
	const [nameEn, setNameEn] = useState("");
	const [nameNl, setNameNl] = useState("");
	const [amount, setAmount] = useState("");
	const [baseUnit, setBaseUnit] = useState<"g" | "ml" | "serving">("serving");
	const [nutrientInputs, setNutrientInputs] = useState(EMPTY_NUTRIENT_INPUTS);
	const [logging, setLogging] = useState(false);
	const loggingRef = useRef(false);

	function log() {
		if (loggingRef.current) return;
		const subject = operations.getSubject();
		if (!subject) return;
		try {
			const numericAmount = positiveOneOffNumber(amount, copy.amount);
			const nutrients: Partial<Record<NutrientKey, NutrientValue>> = {};
			for (const key of NUTRIENT_KEYS) {
				if (!nutrientInputs[key].trim()) continue;
				const value = Number(nutrientInputs[key].replace(",", ".").trim());
				if (!Number.isFinite(value) || value < 0) throw new Error(key);
				nutrients[key] = { kind: "value", amount: value };
			}
			loggingRef.current = true;
			setLogging(true);
			operations.create(
				subject,
				oneOffLogSnapshot({
					date,
					meal,
					name: { en: nameEn.trim(), nl: nameNl.trim() },
					amount: numericAmount,
					baseUnit,
					nutrients,
					clientEntryId: mintNutritionUuid(),
				}),
				undefined,
				() => toast.error(copy.conversionFailure),
			);
			onAccepted();
		} catch {
			toast.error(copy.conversionFailure);
			setLogging(false);
			loggingRef.current = false;
		}
	}

	return (
		<>
			<AppText variant="title">{copy.logOnce}</AppText>
			<AppText variant="caption">
				{date} · {mealLabel(meal, locale)}
			</AppText>
			<FormTextField
				label={copy.oneOffFoodNameEn}
				value={nameEn}
				onChangeText={setNameEn}
			/>
			<FormTextField
				label={copy.oneOffFoodNameNl}
				value={nameNl}
				onChangeText={setNameNl}
			/>
			<FormTextField
				label={copy.amount}
				value={amount}
				onChangeText={setAmount}
				keyboardType="decimal-pad"
			/>
			<View style={styles.actions}>
				{(
					[
						["serving", copy.servings],
						["g", copy.grams],
						["ml", copy.millilitres],
					] as const
				).map(([unit, label]) => (
					<GhostButton
						key={unit}
						label={label}
						onPress={() => setBaseUnit(unit)}
						style={baseUnit === unit ? styles.selected : undefined}
					/>
				))}
			</View>
			<AppText variant="caption">{copy.estimated}</AppText>
			<AppText variant="caption">{copy.nutrientAmountHelp}</AppText>
			{NUTRIENT_KEYS.map((key) => (
				<FormTextField
					key={key}
					label={labels[key]}
					value={nutrientInputs[key]}
					onChangeText={(value) =>
						setNutrientInputs((current) => ({ ...current, [key]: value }))
					}
					keyboardType="decimal-pad"
				/>
			))}
			<PrimaryButton
				label={copy.logOnceConfirm}
				onPress={log}
				disabled={!nameEn.trim() || !nameNl.trim() || !amount.trim()}
				loading={logging}
			/>
			<GhostButton label={copy.cancel} onPress={onCancel} disabled={logging} />
		</>
	);
}

function mealLabel(meal: MealSlot, locale: "en" | "nl") {
	return {
		breakfast: { en: "Breakfast", nl: "Ontbijt" },
		lunch: { en: "Lunch", nl: "Lunch" },
		dinner: { en: "Dinner", nl: "Diner" },
		snacks: { en: "Snacks", nl: "Tussendoortjes" },
	}[meal][locale];
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: spacing.md },
	card: { gap: spacing.xs },
	actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
	selected: { borderColor: colors.accent, backgroundColor: colors.accentDim },
});
