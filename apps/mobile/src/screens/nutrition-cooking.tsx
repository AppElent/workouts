import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { nutritionCookingCopy } from "../data/nutrition-cooking-copy";
import type { MealSlot } from "../data/nutrition-day";
import { oneOffLogSnapshot } from "../data/nutrition-one-off";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../data/nutrition-operation-service";
import { useI18n } from "../i18n";
import { spacing, type Tokens, useThemedStyles } from "../theme";
import { PrimaryButton } from "../ui/button";
import { Card } from "../ui/coach";
import {
	FormScreen,
	FormSection,
	FormSegmentedRow,
	FormTextField,
	InlineNumberFieldRow,
	TextAction,
} from "../ui/form";
import { ScreenHeader } from "../ui/screen-header";
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
	const styles = useThemedStyles(createStyles);
	const { locale, t } = useI18n();
	const copy = nutritionCookingCopy(locale);
	const operations = useNutritionOperations();
	const toast = useToast();
	const router = useRouter();
	const [mode, setMode] = useState<Mode>(() => initialMode ?? "hub");

	if (mode === "oneoff-log") {
		return (
			<OneOffLogger
				copy={copy}
				locale={locale}
				date={date}
				meal={meal}
				operations={operations}
				labels={t.nutrition.nutrients}
				toast={toast}
				onAccepted={() =>
					router.dismissTo({ pathname: "/nutrition", params: { date } })
				}
				onCancel={() => {
					if (!initialMode) setMode("hub");
					else if (router.canGoBack()) router.back();
					else router.replace({ pathname: "/nutrition", params: { date } });
				}}
			/>
		);
	}
	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			style={styles.root}
			contentContainerStyle={styles.content}
		>
			<ScreenHeader title={copy.title} />
			<Card style={styles.card}>
				<AppText variant="heading">{copy.storageTitle}</AppText>
				<AppText variant="caption">{copy.storageBody}</AppText>
			</Card>
			<PrimaryButton
				label={copy.logOnce}
				onPress={() => setMode("oneoff-log")}
			/>
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
		const numericAmount = Number(amount.replace(",", ".").trim());
		if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
			toast.error(copy.invalidAmount);
			return;
		}
		const nutrients: Partial<Record<NutrientKey, NutrientValue>> = {};
		for (const key of NUTRIENT_KEYS) {
			if (!nutrientInputs[key].trim()) continue;
			const value = Number(nutrientInputs[key].replace(",", ".").trim());
			if (!Number.isFinite(value) || value < 0) {
				toast.error(`${labels[key]}: ${copy.invalidNutrient}`);
				return;
			}
			nutrients[key] = { kind: "value", amount: value };
		}
		try {
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
		<FormScreen
			primaryAction={{
				label: copy.logOnceConfirm,
				onPress: log,
				disabled: !nameEn.trim() || !nameNl.trim() || !amount.trim(),
				loading: logging,
			}}
		>
			<ScreenHeader title={copy.logOnce} />
			<AppText variant="caption">
				{date} · {mealLabel(meal, locale)}
			</AppText>
			<FormSection>
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
			</FormSection>
			<FormSection title={copy.amount}>
				<FormSegmentedRow
					options={[
						{ value: "serving", label: copy.servings },
						{ value: "g", label: copy.grams },
						{ value: "ml", label: copy.millilitres },
					]}
					value={baseUnit}
					onChange={setBaseUnit}
				/>
				<InlineNumberFieldRow
					label={copy.amount}
					suffix={baseUnit === "serving" ? "" : baseUnit}
					value={amount}
					onChangeText={setAmount}
					keyboardType="decimal-pad"
				/>
			</FormSection>
			<FormSection title={copy.estimated} footer={copy.nutrientAmountHelp}>
				{NUTRIENT_KEYS.map((key) => (
					<InlineNumberFieldRow
						key={key}
						label={labels[key]}
						suffix={key === "energy" ? "kcal" : "g"}
						value={nutrientInputs[key]}
						keyboardType="decimal-pad"
						onChangeText={(value) =>
							setNutrientInputs((current) => ({ ...current, [key]: value }))
						}
					/>
				))}
			</FormSection>
			<TextAction label={copy.cancel} onPress={onCancel} disabled={logging} />
		</FormScreen>
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

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			padding: 20,
			paddingTop: 12,
			paddingBottom: 40,
			gap: spacing.md,
		},
		card: { gap: spacing.xs },
	});
