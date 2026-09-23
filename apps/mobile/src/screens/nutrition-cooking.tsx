import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { usePersonalFoods } from "../data/personal-foods";
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
	InlineActionRow,
	InlineNumberFieldRow,
	TextAction,
} from "../ui/form";
import { ScreenHeader } from "../ui/screen-header";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import {
	type FoodAuthoringKind,
	FoodAuthoringTabs,
} from "./food-authoring-tabs";
import { personalFoodEditorCopy } from "./personal-food-editor-copy";
import { PersonalFoodEditorForm } from "./personal-food-editor-form";

type Mode = "hub" | FoodAuthoringKind;

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
	initialMode?: "oneoff-log" | FoodAuthoringKind;
}) {
	const styles = useThemedStyles(createStyles);
	const { locale, t } = useI18n();
	const copy = nutritionCookingCopy(locale);
	const operations = useNutritionOperations();
	const toast = useToast();
	const router = useRouter();
	const [mode, setMode] = useState<Mode>(() =>
		initialMode === "oneoff-log" ? "oneOff" : (initialMode ?? "hub"),
	);

	if (mode === "personal") {
		return (
			<PersonalFoodEditorForm
				onCancel={() => setMode("oneOff")}
				onCreateKindChange={setMode}
				onSaved={() => setMode("oneOff")}
			/>
		);
	}

	if (mode === "oneOff" || mode === "recipe") {
		return (
			<OneOffLogger
				kind={mode}
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
				onKindChange={setMode}
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
			<PrimaryButton label={copy.logOnce} onPress={() => setMode("oneOff")} />
		</ScrollView>
	);
}

function OneOffLogger({
	kind,
	copy,
	locale,
	date,
	meal,
	operations,
	labels,
	toast,
	onAccepted,
	onCancel,
	onKindChange,
}: {
	kind: "oneOff" | "recipe";
	copy: ReturnType<typeof nutritionCookingCopy>;
	locale: "en" | "nl";
	date: string;
	meal: MealSlot;
	operations: ReturnType<typeof useNutritionOperations>;
	labels: Readonly<Record<NutrientKey, string>>;
	toast: { error: (message: string) => void };
	onAccepted: () => void;
	onCancel: () => void;
	onKindChange: (kind: FoodAuthoringKind) => void;
}) {
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const personalFoods = usePersonalFoods();
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
			if (kind === "recipe") {
				const recipeNutrients = Object.fromEntries(
					NUTRIENT_KEYS.map((key) => [
						key,
						nutrients[key] ?? { kind: "absent" as const },
					]),
				) as Record<NutrientKey, NutrientValue>;
				personalFoods.create({
					name: { en: name.trim(), nl: name.trim() },
					baseUnit: "serving",
					nutrients: recipeNutrients,
					servings: [],
					classification: "recipe",
					nutritionBasis: {
						kind: "perServing",
						label: { en: "serving", nl: "portie" },
					},
					estimated: true,
					provenance: {
						recordOrigin: "personal",
						nutritionSource: "manual",
						locallyEdited: false,
					},
					...(visual ? { visual } : {}),
				});
				visualCommitted.current = true;
				onAccepted();
				return;
			}
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
			<View
				collapsable={false}
				style={[
					styles.sheetHeader,
					{ paddingTop: insets.top, minHeight: 52 + insets.top },
				]}
			>
				<Pressable
					onPress={cancel}
					disabled={logging}
					accessibilityRole="button"
					style={styles.sheetHeaderAction}
				>
					<AppText style={styles.sheetHeaderCancelText}>{copy.cancel}</AppText>
				</Pressable>
				<View style={styles.sheetTitleSpacer} />
				<Pressable
					onPress={log}
					disabled={logging || !name.trim() || !amount.trim()}
					accessibilityRole="button"
					accessibilityLabel={
						kind === "recipe"
							? `${visualCopy.save} ${visualCopy.recipe}`
							: copy.logOnceConfirm
					}
					accessibilityState={{
						disabled: logging || !name.trim() || !amount.trim(),
						busy: logging,
					}}
					style={styles.sheetHeaderAction}
				>
					<AppText style={styles.sheetHeaderActionText}>
						{visualCopy.save}
					</AppText>
				</Pressable>
			</View>
			<AppText variant="heading" style={styles.sheetTitleBelow}>
				{kind === "recipe" ? visualCopy.recipe : copy.logOnce}
			</AppText>
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
				<FoodAuthoringTabs value={kind} onChange={onKindChange} />
				<FormSection>
					<View style={styles.identityRow}>
						<FoodVisualView
							visual={visual}
							label={name || visualCopy.visual}
							size={48}
						/>
						<View style={styles.identityFields}>
							<AppText variant="label">{copy.oneOffFoodName}</AppText>
							<TextInput
								accessibilityLabel={copy.oneOffFoodName}
								value={name}
								onChangeText={setName}
								style={styles.nameInput}
							/>
						</View>
					</View>
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
				</FormSection>
				<AppText variant="caption">
					{date} · {mealLabel(meal, locale)}
				</AppText>
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
		sheetHeaderActionText: { color: colors.accent, fontWeight: "700" },
		sheetHeaderCancelText: { color: colors.textMuted, fontWeight: "500" },
		sheetTitleSpacer: { flex: 1 },
		sheetTitleBelow: {
			paddingHorizontal: 20,
			paddingBottom: spacing.sm,
		},
		identityRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
			padding: spacing.sm,
		},
		identityFields: { flex: 1, minWidth: 0, gap: spacing.xs },
		nameInput: {
			minHeight: 44,
			borderRadius: 8,
			borderCurve: "continuous",
			backgroundColor: colors.surface2,
			paddingHorizontal: spacing.md,
			color: colors.text,
			fontSize: 16,
		},
		visualActions: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "flex-end",
			paddingHorizontal: spacing.sm,
		},
		card: { gap: spacing.xs },
	});
