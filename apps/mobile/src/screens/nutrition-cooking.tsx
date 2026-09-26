import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFoodAuthoringIntent } from "../data/food-authoring-intent";
import { foodPhotos } from "../data/food-photo-manager";
import { nutritionCookingCopy } from "../data/nutrition-cooking-copy";
import type { MealSlot } from "../data/nutrition-day";
import { oneOffLogSnapshot } from "../data/nutrition-one-off";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../data/nutrition-operation-service";
import {
	FOOD_VISUAL_PRESET_IDS,
	type FoodVisual,
	type FoodVisualPresetId,
} from "../data/personal-food-repository";
import { useI18n } from "../i18n";
import { spacing, type Tokens, useThemedStyles } from "../theme";
import { PrimaryButton } from "../ui/button";
import { Card } from "../ui/coach";
import { FoodVisualView } from "../ui/food-visual";
import { FoodVisualMenu } from "../ui/food-visual-menu";
import {
	DisclosureRow,
	FormSection,
	FormSegmentedRow,
	FormTextField,
	InlineActionRow,
	InlineNumberFieldRow,
	TextAction,
} from "../ui/form";
import { ScreenHeader } from "../ui/screen-header";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { FoodAuthoringTabs } from "./food-authoring-tabs";
import { personalFoodEditorCopy } from "./personal-food-editor-copy";

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
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const authoringIntent = useFoodAuthoringIntent();
	const visualCopy = personalFoodEditorCopy[locale];
	const [name, setName] = useState("");
	const [amount, setAmount] = useState("");
	const [baseUnit, setBaseUnit] = useState<"g" | "ml" | "serving">("serving");
	const [nutrientInputs, setNutrientInputs] = useState(EMPTY_NUTRIENT_INPUTS);
	const [showMoreNutrients, setShowMoreNutrients] = useState(false);
	const [visual, setVisual] = useState<FoodVisual>();
	const [photoBusy, setPhotoBusy] = useState(false);
	const stagedPhoto = useRef<string | undefined>(undefined);
	const visualCommitted = useRef(false);
	const [logging, setLogging] = useState(false);
	const loggingRef = useRef(false);

	useEffect(
		() => () => {
			if (!visualCommitted.current && stagedPhoto.current) {
				foodPhotos.remove({ kind: "photo", uri: stagedPhoto.current });
			}
		},
		[],
	);

	function replaceVisual(next: FoodVisual | undefined) {
		if (
			stagedPhoto.current &&
			(next?.kind !== "photo" || next.uri !== stagedPhoto.current)
		) {
			foodPhotos.remove({ kind: "photo", uri: stagedPhoto.current });
			stagedPhoto.current = undefined;
		}
		setVisual(next);
	}

	async function choosePhoto() {
		if (photoBusy) return;
		setPhotoBusy(true);
		try {
			const choice = await foodPhotos.choose("library");
			if (choice.kind === "selected") {
				replaceVisual(choice.visual);
				stagedPhoto.current = choice.visual.uri;
			} else if (choice.kind === "denied") {
				toast.error(visualCopy.photoPermissionDenied);
			}
		} catch {
			toast.error(visualCopy.photoFailure);
		} finally {
			setPhotoBusy(false);
		}
	}

	function cancel() {
		replaceVisual(undefined);
		onCancel();
	}

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
					// One-off names are free text rather than translated library records.
					name: { en: name.trim(), nl: name.trim() },
					amount: numericAmount,
					baseUnit,
					nutrients,
					visual,
					clientEntryId: mintNutritionUuid(),
				}),
				undefined,
				() => toast.error(copy.conversionFailure),
			);
			visualCommitted.current = true;
			onAccepted();
		} catch {
			toast.error(copy.conversionFailure);
			setLogging(false);
			loggingRef.current = false;
		}
	}

	return (
		<>
			<View collapsable={false} style={styles.sheetHeader}>
				<Pressable
					onPress={cancel}
					disabled={logging}
					accessibilityRole="button"
					style={styles.sheetHeaderAction}
				>
					<AppText style={styles.sheetHeaderCancelText}>{copy.cancel}</AppText>
				</Pressable>
				<View style={styles.sheetTitle} />
				<Pressable
					onPress={log}
					disabled={logging || !name.trim() || !amount.trim()}
					accessibilityRole="button"
					accessibilityState={{
						disabled: logging || !name.trim() || !amount.trim(),
						busy: logging,
					}}
					style={styles.sheetHeaderAction}
				>
					<AppText style={styles.sheetHeaderActionText}>
						{copy.logOnceConfirm}
					</AppText>
				</Pressable>
			</View>
			<ScrollView
				style={styles.root}
				contentInsetAdjustmentBehavior="automatic"
				automaticallyAdjustKeyboardInsets
				keyboardDismissMode="interactive"
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={[
					styles.sheetContent,
					{ paddingBottom: Math.max(insets.bottom, spacing.lg) },
				]}
			>
				<FoodAuthoringTabs
					value="oneOff"
					onChange={(value) => {
						if (value === "oneOff") return;
						replaceVisual(undefined);
						authoringIntent.request(value);
						router.dismissTo({
							pathname: "/nutrition-food",
							params: { date, meal, create: value },
						});
					}}
				/>
				<FormSection title={visualCopy.visual}>
					<View style={styles.visualRow}>
						<FoodVisualView
							visual={visual}
							label={name || visualCopy.visual}
							size={52}
						/>
						<View style={styles.visualActions}>
							<FoodVisualMenu
								label={visualCopy.visual}
								options={[
									{ value: "default", label: visualCopy.defaultVisual },
									...FOOD_VISUAL_PRESET_IDS.map((preset) => ({
										value: preset,
										label: visualCopy.visualPresets[preset],
									})),
								]}
								selectedValue={
									visual?.kind === "icon" ? visual.preset : "default"
								}
								onSelect={(id) =>
									replaceVisual(
										id === "default"
											? undefined
											: {
													kind: "icon",
													preset: id as FoodVisualPresetId,
												},
									)
								}
							/>
							<InlineActionRow>
								<TextAction
									label={
										visual?.kind === "photo"
											? visualCopy.replacePhoto
											: visualCopy.choosePhoto
									}
									onPress={() => void choosePhoto()}
									disabled={photoBusy}
								/>
								{visual?.kind === "photo" ? (
									<TextAction
										label={visualCopy.removePhoto}
										onPress={() => replaceVisual(undefined)}
										disabled={photoBusy}
										tone="destructive"
									/>
								) : null}
							</InlineActionRow>
						</View>
					</View>
				</FormSection>
				<AppText variant="caption">
					{date} · {mealLabel(meal, locale)}
				</AppText>
				<FormSection>
					<FormTextField
						label={copy.oneOffFoodName}
						value={name}
						onChangeText={setName}
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
					{NUTRIENT_KEYS.filter(
						(key) => key === "energy" || key === "protein" || showMoreNutrients,
					).map((key) => (
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
					<DisclosureRow
						label={copy.moreNutrients}
						expanded={showMoreNutrients}
						onPress={() => setShowMoreNutrients((current) => !current)}
					/>
				</FormSection>
			</ScrollView>
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

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			padding: 20,
			paddingTop: 12,
			paddingBottom: 40,
			gap: spacing.md,
		},
		sheetContent: {
			alignSelf: "center",
			width: "100%",
			maxWidth: 640,
			paddingHorizontal: 20,
			paddingTop: spacing.sm,
			gap: spacing.lg,
		},
		sheetHeader: {
			minHeight: 52,
			flexDirection: "row",
			alignItems: "center",
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: colors.border,
			backgroundColor: colors.bg,
		},
		sheetHeaderAction: {
			minWidth: 88,
			minHeight: 48,
			paddingHorizontal: spacing.md,
			alignItems: "center",
			justifyContent: "center",
		},
		sheetHeaderCancelText: { color: colors.textMuted, fontWeight: "500" },
		sheetHeaderActionText: { color: colors.accent, fontWeight: "700" },
		sheetTitle: { flex: 1, textAlign: "center" },
		visualRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
			padding: spacing.md,
		},
		visualActions: { flex: 1 },
		card: { gap: spacing.xs },
	});
