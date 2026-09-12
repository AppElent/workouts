import {
	forkHasLocalEdits,
	forkSource,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";
import { useMemo, useRef, useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	type PersonalFood,
	type PersonalFoodDraft,
	validatePersonalFoodDraft,
} from "../data/personal-food-repository";
import { usePersonalFoods } from "../data/personal-foods";
import { fmt, useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card } from "../ui/coach";
import { Segmented } from "../ui/segmented";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { NutritionMenu } from "./nutrition-menu";
import {
	copyWithLabel,
	copyWithServing,
	personalFoodEditorCopy,
} from "./personal-food-editor-copy";

type NutrientInput = { kind: NutrientValue["kind"]; amount: string };
type ServingInput = { key: string; en: string; nl: string; amount: string };

const PRIMARY_NUTRIENTS = ["energy", "protein", "carbs", "fat"] as const;
const MORE_NUTRIENTS = NUTRIENT_KEYS.filter(
	(key) =>
		!PRIMARY_NUTRIENTS.includes(key as (typeof PRIMARY_NUTRIENTS)[number]),
);

type EditorSeed = Pick<
	PersonalFoodDraft,
	"name" | "baseUnit" | "nutrients" | "servings"
>;

function initialNutrients(
	seed?: EditorSeed,
): Record<NutrientKey, NutrientInput> {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => {
			const value = seed?.nutrients[key] ?? { kind: "absent" as const };
			return [
				key,
				{
					kind: value.kind,
					amount:
						value.kind === "value"
							? String(value.amount).replace(".", ",")
							: "",
				},
			];
		}),
	) as Record<NutrientKey, NutrientInput>;
}

function initialServings(seed?: EditorSeed): ServingInput[] {
	return (
		seed?.servings.map((serving, index) => ({
			key: `existing-${index}`,
			en: serving.label.en,
			nl: serving.label.nl,
			amount: String(serving.amount).replace(".", ","),
		})) ?? []
	);
}

function draftUnchanged(a: EditorSeed, b: EditorSeed): boolean {
	return (
		a.name.en === b.name.en &&
		a.name.nl === b.name.nl &&
		a.baseUnit === b.baseUnit &&
		NUTRIENT_KEYS.every(
			(key) =>
				JSON.stringify(a.nutrients[key]) === JSON.stringify(b.nutrients[key]),
		) &&
		JSON.stringify(a.servings) === JSON.stringify(b.servings)
	);
}

function parseNumber(text: string): number {
	return Number(text.trim().replace(",", "."));
}

export function PersonalFoodEditorForm({
	food,
	seed,
	reviewNotice,
	onSaved,
	onCancel,
}: {
	food?: PersonalFood;
	seed?: PersonalFoodDraft;
	reviewNotice?: { title: string; body: string; attribution?: string };
	onSaved: (saved: PersonalFood) => void;
	onCancel: () => void;
}) {
	const { t, locale } = useI18n();
	const copy = personalFoodEditorCopy[locale];
	const insets = useSafeAreaInsets();
	const personalFoods = usePersonalFoods();
	const toast = useToast();
	const initial = food ?? seed;
	const otherLocale = locale === "en" ? "nl" : "en";
	const [primaryName, setPrimaryName] = useState(initial?.name[locale] ?? "");
	const [otherName, setOtherName] = useState(initial?.name[otherLocale] ?? "");
	const [otherNameOpen, setOtherNameOpen] = useState(false);
	const [baseUnit, setBaseUnit] = useState<"g" | "ml">(
		initial?.baseUnit ?? "g",
	);
	const [nutrients, setNutrients] = useState(() => initialNutrients(initial));
	const [moreNutrientsOpen, setMoreNutrientsOpen] = useState(false);
	const [servings, setServings] = useState(() => initialServings(initial));
	const [servingsOpen, setServingsOpen] = useState(() => servings.length > 0);
	const nextServingKey = useRef(servings.length);
	const [validationError, setValidationError] = useState<string>();
	const [saving, setSaving] = useState(false);
	const saveLock = useRef(false);

	const source = useMemo(
		() => (initial ? forkSource(initial) : undefined),
		[initial],
	);

	function updateNutrient(key: NutrientKey, update: Partial<NutrientInput>) {
		setNutrients((current) => ({
			...current,
			[key]: { ...current[key], ...update },
		}));
	}

	function setAmount(key: NutrientKey, amount: string) {
		updateNutrient(key, {
			kind: amount.trim().length === 0 ? "absent" : "value",
			amount,
		});
	}

	function buildDraft(): PersonalFoodDraft {
		const values = {} as Record<NutrientKey, NutrientValue>;
		for (const key of NUTRIENT_KEYS) {
			const input = nutrients[key];
			values[key] =
				input.kind === "value"
					? { kind: "value", amount: parseNumber(input.amount) }
					: { kind: input.kind };
		}

		const fallbackOtherName =
			otherName.trim().length > 0 ? otherName : primaryName;
		const name =
			locale === "en"
				? { en: primaryName, nl: fallbackOtherName }
				: { en: fallbackOtherName, nl: primaryName };
		const editable: EditorSeed = {
			name,
			baseUnit,
			nutrients: values,
			servings: servings.map((serving) => {
				const primary = locale === "en" ? serving.en : serving.nl;
				const other = locale === "en" ? serving.nl : serving.en;
				const fallbackOther = other.trim().length > 0 ? other : primary;
				return {
					label:
						locale === "en"
							? { en: primary, nl: fallbackOther }
							: { en: fallbackOther, nl: primary },
					amount: parseNumber(serving.amount),
				};
			}),
		};

		let provenance = initial?.provenance ?? {
			recordOrigin: "personal" as const,
			nutritionSource: "manual" as const,
			locallyEdited: false,
		};
		if (source) {
			provenance = {
				...provenance,
				locallyEdited: forkHasLocalEdits(editable, source),
			};
		} else if (!food && seed && !draftUnchanged(editable, seed)) {
			provenance = { ...provenance, locallyEdited: true };
		}
		return { ...editable, provenance };
	}

	async function save() {
		if (saving || saveLock.current) return;
		setValidationError(undefined);
		let draft: PersonalFoodDraft;
		try {
			draft = validatePersonalFoodDraft(buildDraft());
		} catch (error) {
			setValidationError(
				error instanceof Error
					? error.message
					: t.nutrition.personalFood.validation,
			);
			return;
		}
		saveLock.current = true;
		setSaving(true);
		await Promise.resolve();
		try {
			const saved = food
				? personalFoods.update(food.id, draft)
				: personalFoods.create(draft);
			onSaved(saved);
		} catch {
			toast.error(t.nutrition.personalFood.saveFailure);
		} finally {
			saveLock.current = false;
			setSaving(false);
		}
	}

	const visibleNutrients = [
		...PRIMARY_NUTRIENTS,
		...(moreNutrientsOpen ? MORE_NUTRIENTS : []),
	];

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={[
				styles.content,
				{ paddingBottom: insets.bottom + spacing.xxl },
			]}
			keyboardShouldPersistTaps="handled"
		>
			<AppText variant="title" style={styles.title}>
				{source
					? t.nutrition.fork.title
					: reviewNotice
						? reviewNotice.title
						: food
							? t.nutrition.personalFood.editTitle
							: t.nutrition.personalFood.createTitle}
			</AppText>
			{source ? (
				<Card style={styles.disclosure}>
					<AppText variant="heading">
						{fmt(t.nutrition.fork.forkedFrom, {
							name: source.sourceName[locale],
						})}
					</AppText>
					<AppText variant="caption">{t.nutrition.fork.intro}</AppText>
				</Card>
			) : null}
			{reviewNotice ? (
				<Card style={styles.disclosure}>
					<AppText variant="caption">{reviewNotice.body}</AppText>
					{reviewNotice.attribution ? (
						<AppText variant="caption">{reviewNotice.attribution}</AppText>
					) : null}
				</Card>
			) : null}

			<LabeledInput
				label={copy.name}
				value={primaryName}
				onChangeText={setPrimaryName}
			/>
			<DisclosureButton
				label={copy.otherName}
				actionLabel={
					otherNameOpen
						? copy.hideOtherName
						: otherName.trim()
							? copy.editOtherName
							: copy.addOtherName
				}
				expanded={otherNameOpen}
				onPress={() => setOtherNameOpen((open) => !open)}
			/>
			{otherNameOpen ? (
				<LabeledInput
					label={copy.otherName}
					value={otherName}
					onChangeText={setOtherName}
				/>
			) : null}

			<View style={styles.unitSection}>
				<AppText variant="label">{copy.per100}</AppText>
				<Segmented
					value={baseUnit}
					onChange={setBaseUnit}
					options={[
						{
							value: "g",
							label: copy.grams,
							accessibilityLabel: `${copy.per100} ${copy.grams}`,
						},
						{
							value: "ml",
							label: copy.millilitres,
							accessibilityLabel: `${copy.per100} ${copy.millilitres}`,
						},
					]}
				/>
			</View>

			<View style={styles.sectionHeading}>
				<AppText variant="heading" style={styles.headingText}>
					{copy.nutrition} {copy.per100.toLowerCase()} {baseUnit}
				</AppText>
				<AppText variant="caption">{copy.nutrientHelper}</AppText>
			</View>
			{visibleNutrients.map((key) => (
				<NutrientRow
					key={key}
					label={t.nutrition.nutrients[key]}
					baseUnit={baseUnit}
					unit={key === "energy" ? "kcal" : "g"}
					input={nutrients[key]}
					valueOptionsLabel={copyWithLabel(
						copy.valueOptions,
						t.nutrition.nutrients[key],
					)}
					onAmountChange={(amount) => setAmount(key, amount)}
					onStateChange={(kind) =>
						updateNutrient(key, {
							kind,
							amount: kind === "value" ? nutrients[key].amount : "",
						})
					}
					unknownLabel={copy.unknown}
					traceLabel={copy.trace}
					closeLabel={copy.close}
				/>
			))}
			<GhostButton
				label={moreNutrientsOpen ? copy.fewerNutrients : copy.moreNutrients}
				onPress={() => setMoreNutrientsOpen((open) => !open)}
			/>

			<DisclosureButton
				label={copy.customServings}
				actionLabel={copy.customServings}
				expanded={servingsOpen}
				onPress={() => setServingsOpen((open) => !open)}
			/>
			{servingsOpen ? (
				<View style={styles.servingsSection}>
					<AppText variant="caption">{copy.customServingsHelp}</AppText>
					{servings.map((serving, index) => (
						<Card key={serving.key} style={styles.serving}>
							<LabeledInput
								label={copyWithServing(copy.servingName, index + 1)}
								value={locale === "en" ? serving.en : serving.nl}
								onChangeText={(value) =>
									setServings((current) =>
										current.map((item, itemIndex) =>
											itemIndex === index
												? locale === "en"
													? { ...item, en: value }
													: { ...item, nl: value }
												: item,
										),
									)
								}
							/>
							<LabeledInput
								label={copyWithServing(copy.servingAmount, index + 1, baseUnit)}
								value={serving.amount}
								onChangeText={(amount) =>
									setServings((current) =>
										current.map((item, itemIndex) =>
											itemIndex === index ? { ...item, amount } : item,
										),
									)
								}
								keyboardType="decimal-pad"
							/>
							<GhostButton
								label={`${copy.removeServing} ${index + 1}`}
								onPress={() =>
									setServings((current) =>
										current.filter((_, itemIndex) => itemIndex !== index),
									)
								}
							/>
						</Card>
					))}
					{servings.length < 3 ? (
						<GhostButton
							label={copy.addServing}
							onPress={() =>
								setServings((current) => {
									nextServingKey.current += 1;
									return [
										...current,
										{
											key: `new-${nextServingKey.current}`,
											en: "",
											nl: "",
											amount: "",
										},
									];
								})
							}
						/>
					) : null}
				</View>
			) : null}

			{validationError ? (
				<AppText accessibilityRole="alert" style={styles.error}>
					{validationError}
				</AppText>
			) : null}
			<PrimaryButton
				label={
					saving
						? t.nutrition.personalFood.saving
						: t.nutrition.personalFood.save
				}
				loading={saving}
				onPress={save}
			/>
			<GhostButton
				label={t.nutrition.personalFood.cancel}
				onPress={onCancel}
				disabled={saving}
			/>
		</ScrollView>
	);
}

function DisclosureButton({
	label,
	actionLabel,
	expanded,
	onPress,
}: {
	label: string;
	actionLabel: string;
	expanded: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={actionLabel}
			accessibilityState={{ expanded }}
			onPress={onPress}
			style={({ pressed }) => [
				styles.disclosureButton,
				pressed ? { backgroundColor: colors.surface2 } : null,
			]}
		>
			<AppText variant="label">{label}</AppText>
			<AppText variant="body" style={styles.disclosureIcon}>
				{expanded ? "−" : "+"}
			</AppText>
		</Pressable>
	);
}

function NutrientRow({
	label,
	baseUnit,
	unit,
	input,
	valueOptionsLabel,
	unknownLabel,
	traceLabel,
	closeLabel,
	onAmountChange,
	onStateChange,
}: {
	label: string;
	baseUnit: "g" | "ml";
	unit: string;
	input: NutrientInput;
	valueOptionsLabel: string;
	unknownLabel: string;
	traceLabel: string;
	closeLabel: string;
	onAmountChange: (value: string) => void;
	onStateChange: (kind: NutrientValue["kind"]) => void;
}) {
	return (
		<View style={styles.nutrientRow}>
			<AppText variant="label" style={styles.nutrientLabel}>
				{label}
			</AppText>
			<View style={styles.nutrientControls}>
				<TextInput
					value={input.amount}
					onChangeText={onAmountChange}
					accessibilityLabel={`${label} per 100 ${baseUnit}`}
					placeholder={input.kind === "trace" ? traceLabel : "—"}
					placeholderTextColor={colors.textFaint}
					keyboardType="decimal-pad"
					style={styles.nutrientInput}
				/>
				<AppText variant="caption" style={styles.nutrientUnit}>
					{unit}
				</AppText>
				<NutritionMenu
					label={valueOptionsLabel}
					closeLabel={closeLabel}
					actions={[
						{ label: unknownLabel, onPress: () => onStateChange("absent") },
						{ label: traceLabel, onPress: () => onStateChange("trace") },
					]}
				/>
			</View>
		</View>
	);
}

function LabeledInput({
	label,
	...props
}: {
	label: string;
	value: string;
	onChangeText: (value: string) => void;
	keyboardType?: "decimal-pad";
}) {
	return (
		<View style={styles.field}>
			<AppText variant="label">{label}</AppText>
			<TextInput
				{...props}
				accessibilityLabel={label}
				style={styles.input}
				autoCorrect={false}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: {
		alignSelf: "center",
		width: "100%",
		maxWidth: 640,
		padding: 20,
		gap: spacing.md,
	},
	title: { maxWidth: "100%" },
	disclosure: { gap: spacing.xs },
	field: { gap: spacing.xs },
	input: {
		minHeight: 48,
		borderRadius: radius.md,
		backgroundColor: colors.surface2,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		paddingHorizontal: spacing.md,
		color: colors.text,
		fontSize: 15,
	},
	disclosureButton: {
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: spacing.sm,
		borderRadius: radius.md,
	},
	disclosureIcon: { color: colors.accent, fontWeight: "800" },
	unitSection: { gap: spacing.xs },
	sectionHeading: { gap: spacing.xs },
	headingText: { maxWidth: "100%" },
	nutrientRow: {
		minHeight: 52,
		flexDirection: "row",
		alignItems: "flex-start",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	nutrientLabel: {
		flex: 1,
		minWidth: 120,
		paddingTop: spacing.md,
		paddingRight: spacing.xs,
	},
	nutrientControls: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		flexShrink: 0,
	},
	nutrientInput: {
		width: 82,
		minHeight: 44,
		borderRadius: radius.md,
		backgroundColor: colors.surface2,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		paddingHorizontal: spacing.sm,
		color: colors.text,
		fontSize: 15,
		textAlign: "right",
	},
	nutrientUnit: { width: 30, textAlign: "left" },
	servingsSection: { gap: spacing.sm },
	serving: { gap: spacing.sm },
	error: { color: colors.danger },
});
