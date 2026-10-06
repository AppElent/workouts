import {
	forkSource,
	NEVO_ATTRIBUTION,
	NUTRIENT_KEYS,
	SALT_DERIVATION_DISCLOSURE,
	type ServingOption,
} from "@workouts/core/nutrition";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { DiaryEntry, MealSlot } from "../../../../data/nutrition-day";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../../../../data/nutrition-operation-service";
import {
	portionMemoryFor,
	rememberedSelection,
} from "../../../../data/nutrition-shortcuts";
import {
	usePersonalMeasureActions,
	usePersonalMeasures,
} from "../../../../data/personal-measures";
import { useSupplementaryServings } from "../../../../data/supplementary-servings";
import { haptics } from "../../../../feedback/haptics";
import { fmt, useI18n } from "../../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	type,
	useThemedStyles,
	useTokens,
} from "../../../../theme";
import { GhostButton, PrimaryButton } from "../../../../ui/button";
import { Card } from "../../../../ui/coach";
import { FoodVisualView } from "../../../../ui/food-visual";
import {
	DisclosureRow,
	FormSection,
	FormSegmentedRow,
	InlineNumberFieldRow,
} from "../../../../ui/form";
import { AppText } from "../../../../ui/text";
import { useToast } from "../../../../ui/toast";
import {
	createFoodSnapshot,
	type FoodSelection,
	formatNutrient,
	type LogOutcome,
	selectionSourceKey,
	servingChoices,
	servingPreview,
} from "../log-food-selection";

/**
 * Choosing a serving, presented as a sheet over the results (spec #68: "Choosing
 * a food opens a serving sheet").
 *
 * A sheet rather than another pushed screen because the search you came from is
 * still the context: you are checking a number against a food you just found,
 * and half the time you dismiss and pick a different one. It keeps the results
 * visible behind it, dismisses on a backdrop tap and on Android's back button,
 * and slides from the bottom edge — which is where dismissing sends it — unless
 * the person has asked for reduced motion, in which case it cuts.
 */
export function LogFoodServingSheet({
	selection,
	meal,
	date,
	onBack,
	onLogged,
	onPendingChange,
	onEdit,
	onDelete,
	onCorrect,
}: {
	selection: FoodSelection;
	meal: MealSlot;
	date: string;
	onBack: () => void;
	onLogged: (outcome: LogOutcome, foodName: string, entry: DiaryEntry) => void;
	onPendingChange: (pending: boolean) => void;
	onEdit?: () => void;
	onDelete?: () => void;
	/** Start a correction of this shipped food. Absent for a local food. */
	onCorrect?: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const { t, locale } = useI18n();
	const router = useRouter();
	const operations = useNutritionOperations();
	const personalMeasures = usePersonalMeasures();
	const measureActions = usePersonalMeasureActions();
	const toast = useToast();
	const [logging, setLogging] = useState(false);
	const loggingRef = useRef(false);
	const food = selection.food;
	const supplementary = useSupplementaryServings(
		selection.kind === "shipped" ? food.id : undefined,
	);
	const choices = useMemo(
		() => servingChoices(selection, personalMeasures, supplementary.servings),
		[personalMeasures, selection, supplementary.servings],
	);
	const subject = operations.getSubject();
	const sourceKey = selectionSourceKey(selection);
	const remembered = useMemo(
		() =>
			rememberedSelection(
				choices,
				food.baseUnit,
				subject
					? operations.getShortcut(subject, sourceKey)?.portion
					: undefined,
			),
		[choices, food.baseUnit, operations, sourceKey, subject],
	);
	const defaultServing =
		remembered?.option ??
		choices.find((choice) => choice.kind !== "personal-measure") ??
		choices[0];
	const [selectedServing, setSelectedServing] =
		useState<ServingOption>(defaultServing);
	const [quantityText, setQuantityText] = useState(() =>
		String(
			remembered?.quantity ??
				(defaultServing?.kind === "base-unit" &&
				defaultServing.unit !== "serving"
					? 100
					: 1),
		),
	);
	const [favorite, setFavorite] = useState(() =>
		subject ? operations.getShortcut(subject, sourceKey)?.favorite : false,
	);
	useEffect(() => {
		if (!measureActions.lastCreatedId) return;
		const created = choices.find(
			(option) =>
				option.kind === "personal-measure" &&
				option.id === measureActions.lastCreatedId,
		);
		if (created) {
			setSelectedServing(created);
			setQuantityText("1");
			measureActions.consumeCreated();
		}
	}, [choices, measureActions]);
	const parsed =
		quantityText.trim() === ""
			? Number.NaN
			: Number(quantityText.replace(",", "."));
	const quantity = Number.isFinite(parsed) ? parsed : 0;
	const preview = servingPreview(
		selection,
		selectedServing,
		quantity > 0 ? quantity : 1,
		locale,
	);
	const canLog = quantity > 0;
	/** The shipped record behind a correction — the original, still nameable. */
	const correctedSource =
		selection.kind === "personal" ? forkSource(selection.food) : undefined;

	async function logFood(outcome: LogOutcome) {
		if (!canLog || loggingRef.current) return;
		loggingRef.current = true;
		setLogging(true);
		onPendingChange(true);
		try {
			const subject = operations.getSubject();
			if (!subject) throw new Error("Not signed in.");
			const clientEntryId = mintNutritionUuid();
			const { common, provenance } = createFoodSnapshot(
				selection,
				selectedServing,
				quantity,
				date,
				meal,
				clientEntryId,
				locale,
			);
			operations.create(
				subject,
				{ ...common, provenance },
				{
					sourceKey,
					portion: portionMemoryFor(selectedServing, quantity, food.baseUnit),
				},
				(_error) => {
					loggingRef.current = false;
					setLogging(false);
					onPendingChange(false);
					toast.error(t.nutrition.foodBrowser.logFailure);
				},
				() => {
					haptics.entryLogged();
					onLogged(outcome, food.name[locale], {
						id: `client:${clientEntryId}`,
						...common,
						provenance,
					});
					loggingRef.current = false;
					setLogging(false);
					onPendingChange(false);
				},
			);
		} catch {
			loggingRef.current = false;
			setLogging(false);
			onPendingChange(false);
			toast.error(t.nutrition.foodBrowser.logFailure);
		}
	}

	return (
		<View style={styles.sheet}>
			<View
				accessible
				accessibilityLabel={t.nutrition.foodBrowser.sheetHandle}
				style={styles.sheetHandle}
			/>
			<View style={styles.sheetHeader}>
				<AppText variant="heading" style={styles.flex} numberOfLines={2}>
					{food.name[locale]}
				</AppText>
				<Pressable
					onPress={onBack}
					disabled={logging}
					hitSlop={12}
					accessibilityRole="button"
					// Its own name, not "Go back": the browser's header back is
					// still on screen behind the sheet, and two controls called
					// the same thing is two controls a screen reader cannot tell
					// apart.
					accessibilityLabel={t.nutrition.foodBrowser.closeServingLabel}
					style={styles.sheetClose}
				>
					<AppText style={styles.sheetCloseGlyph}>×</AppText>
				</Pressable>
			</View>
			<KeyboardAvoidingView
				style={styles.sheetBody}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<ScrollView
					contentInsetAdjustmentBehavior="automatic"
					automaticallyAdjustKeyboardInsets
					keyboardDismissMode="interactive"
					contentContainerStyle={styles.sheetContent}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					<View style={styles.heading}>
						{selection.kind === "personal" &&
						selection.food.visualMigrationPending &&
						!selection.food.visual &&
						selection.food.provenance.imageUrl ? (
							<Image
								source={selection.food.provenance.imageUrl}
								accessibilityLabel={food.name[locale]}
								cachePolicy="memory-disk"
								contentFit="contain"
								style={styles.detailImage}
							/>
						) : selection.kind === "personal" ? (
							<FoodVisualView
								visual={selection.food.visual}
								label={food.name[locale]}
								size={112}
							/>
						) : (
							<AppText variant="display">{selection.food.emoji ?? "🍽️"}</AppText>
						)}
						{/* The sheet header already carries the name and keeps it in
							    place while this scrolls, so the body shows what the header
							    cannot: the glyph, and where the figures came from. */}
						<AppText variant="caption">
							{selection.kind === "shipped"
								? selection.food.sourceName[locale]
								: correctedSource
									? t.nutrition.fork.resultLabel
									: t.nutrition.personalFood.resultLabel}
						</AppText>
						{remembered ? (
							<AppText variant="caption">
								{t.nutrition.foodBrowser.lastUsed}
								{remembered.reset
									? ` · ${t.nutrition.foodBrowser.allFoods}`
									: ""}
							</AppText>
						) : null}
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={
								favorite
									? t.nutrition.foodBrowser.removeFavorite
									: t.nutrition.foodBrowser.favorite
							}
							onPress={() => {
								if (!subject) return;
								const next = !favorite;
								operations.toggleFavorite(subject, sourceKey, next);
								setFavorite(next);
							}}
							style={styles.favoriteButton}
						>
							<SymbolView
								name={{
									ios: favorite ? "star.fill" : "star",
									android: favorite ? "star" : "star_border",
									web: favorite ? "star" : "star_border",
								}}
								tintColor={colors.accent}
								size={24}
							/>
						</Pressable>
					</View>
					<FormSection title={t.nutrition.foodBrowser.serving}>
						<FormSegmentedRow
							options={choices.map((candidate, index) => ({
								value: String(index),
								label: candidate.label[locale],
							}))}
							value={String(choices.indexOf(selectedServing))}
							onChange={(value) => {
								const candidate = choices[Number(value)];
								if (!candidate) return;
								if (candidate !== selectedServing) haptics.selectionChanged();
								setSelectedServing(candidate);
								setQuantityText(
									candidate.kind === "base-unit" && candidate.unit !== "serving"
										? "100"
										: "1",
								);
							}}
						/>
						<InlineNumberFieldRow
							label={t.nutrition.foodBrowser.quantity}
							suffix=""
							value={quantityText}
							onChangeText={setQuantityText}
							keyboardType="decimal-pad"
						/>
						<DisclosureRow
							label={t.nutrition.personalMeasures.manage}
							onPress={() =>
								router.push({
									pathname: "/personal-measures",
									params: { returnTo: "picker", baseUnit: food.baseUnit },
								})
							}
						/>
					</FormSection>
					{selectedServing.kind !== "base-unit" ? (
						<View style={styles.quantityShortcuts}>
							{[
								[t.nutrition.foodBrowser.quantityHalf, "0.5"],
								[t.nutrition.foodBrowser.quantityOne, "1"],
								[t.nutrition.foodBrowser.quantityTwo, "2"],
							].map(([label, value]) => (
								<Pressable
									key={label}
									onPress={() => setQuantityText(value)}
									accessibilityRole="button"
									style={styles.quantityShortcut}
								>
									<AppText>{label}</AppText>
								</Pressable>
							))}
						</View>
					) : null}
					{canLog ? (
						<Card style={styles.preview}>
							<AppText variant="heading">{preview.label}</AppText>
							<AppText variant="caption">
								{preview.amount} {preview.baseUnit}
							</AppText>
							{NUTRIENT_KEYS.map((key) => (
								<View key={key} style={styles.nutrientRow}>
									<AppText style={styles.flex}>
										{t.nutrition.nutrients[key]}
									</AppText>
									<AppText style={styles.strong}>
										{formatNutrient(
											preview.nutrients[key],
											key,
											t.nutrition.foodBrowser,
										)}
									</AppText>
								</View>
							))}
						</Card>
					) : null}
					{selection.kind === "shipped" ? (
						<View style={styles.attribution}>
							<AppText variant="caption">{NEVO_ATTRIBUTION}</AppText>
							<AppText variant="caption">
								{SALT_DERIVATION_DISCLOSURE[locale]}
							</AppText>
							<GhostButton
								label={t.nutrition.fork.correct}
								onPress={onCorrect}
							/>
						</View>
					) : (
						<>
							{correctedSource ? (
								// NEVO attribution follows the figures, not the record: these
								// started as NEVO's and are still shown wherever they are used.
								<View style={styles.attribution}>
									<AppText variant="caption">
										{fmt(t.nutrition.fork.forkedFrom, {
											name: correctedSource.sourceName[locale],
										})}
									</AppText>
									<AppText variant="caption">
										{selection.food.provenance.locallyEdited
											? t.nutrition.fork.locallyEdited
											: t.nutrition.fork.unchanged}
									</AppText>
									<AppText variant="caption">{NEVO_ATTRIBUTION}</AppText>
									<AppText variant="caption">
										{SALT_DERIVATION_DISCLOSURE[locale]}
									</AppText>
								</View>
							) : selection.food.provenance.attribution ? (
								// An imported food carries its provider's attribution instead (#76).
								<View style={styles.attribution}>
									<AppText variant="caption">
										{selection.food.provenance.attribution}
									</AppText>
								</View>
							) : null}
							<View style={styles.options}>
								{/* A correction is stored as a Personal Food, so editing one is
						    the same action under the same name. */}
								<GhostButton
									label={t.nutrition.personalFood.editTitle}
									onPress={onEdit}
								/>
								<GhostButton
									label={t.nutrition.personalFood.delete}
									onPress={onDelete}
								/>
							</View>
						</>
					)}
				</ScrollView>
				<SafeAreaView edges={["bottom"]} style={styles.sheetFooter}>
					<PrimaryButton
						label={
							logging
								? t.nutrition.foodBrowser.logging
								: t.nutrition.foodBrowser.addAndContinue
						}
						onPress={() => logFood("continue")}
						loading={logging}
						disabled={!canLog}
					/>
					<GhostButton
						label={t.nutrition.foodBrowser.addAndClose}
						onPress={() => logFood("close")}
						disabled={!canLog || logging}
					/>
				</SafeAreaView>
			</KeyboardAvoidingView>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		flex: { flex: 1 },
		heading: { gap: spacing.xs, paddingHorizontal: spacing.md },
		strong: { fontWeight: "700" },
		quantityShortcuts: { flexDirection: "row", gap: spacing.sm },
		quantityShortcut: {
			minWidth: 52,
			minHeight: 44,
			alignItems: "center",
			justifyContent: "center",
			borderWidth: 1,
			borderColor: colors.borderStrong,
			borderRadius: radius.pill,
		},
		detailImage: {
			width: 112,
			height: 112,
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
		options: { gap: spacing.md },
		favoriteButton: {
			alignSelf: "flex-end",
			minWidth: 44,
			minHeight: 44,
			alignItems: "center",
			justifyContent: "center",
		},
		preview: { gap: spacing.sm },
		nutrientRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		attribution: { gap: spacing.xs },
		sheet: {
			flex: 1,
			gap: spacing.sm,
			backgroundColor: colors.surface,
			paddingHorizontal: spacing.md,
			paddingTop: spacing.sm,
		},
		sheetHandle: {
			alignSelf: "center",
			width: 36,
			height: 4,
			borderRadius: radius.pill,
			backgroundColor: colors.borderStrong,
		},
		sheetBody: { flex: 1 },
		sheetHeader: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			minHeight: 44,
		},
		sheetClose: {
			width: 44,
			height: 44,
			alignItems: "center",
			justifyContent: "center",
		},
		sheetCloseGlyph: {
			color: colors.accent,
			fontSize: type.display.fontSize - 2,
			fontWeight: "400",
			lineHeight: 32,
		},
		sheetContent: { gap: spacing.md, paddingBottom: spacing.md },
		sheetFooter: { gap: spacing.sm, paddingTop: spacing.sm },
	});
