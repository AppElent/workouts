import {
	forkHasLocalEdits,
	forkSource,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";
import { useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
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

type NutrientInput = { kind: NutrientValue["kind"]; amount: string };
type ServingInput = { key: string; en: string; nl: string; amount: string };

/** The fields a Food Import review seeds from, before any local edit. */
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
					amount: value.kind === "value" ? String(value.amount) : "",
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
			amount: String(serving.amount),
		})) ?? []
	);
}

/**
 * Same figures, name, unit and Servings — used to decide whether a Food
 * Import review counted as a local edit. Nutrients are compared key by key
 * via `NUTRIENT_KEYS` rather than by stringifying the whole object: the
 * import draft and the rebuilt form draft can list the same eight nutrients
 * in different insertion orders, which `JSON.stringify` would wrongly read
 * as a change.
 */
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

export function PersonalFoodEditor({
	food,
	seed,
	reviewNotice,
	onSaved,
	onCancel,
}: {
	food?: PersonalFood;
	/**
	 * A pre-populated draft to author from rather than a blank form — how
	 * correcting a shipped food (#75) and reviewing a Food Import (#76) both
	 * enter this screen. Ignored when `food` is given, because that is an edit
	 * of something already saved.
	 */
	seed?: PersonalFoodDraft;
	/** Shown as a banner above the form when reviewing a remote import rather than authoring from scratch. */
	reviewNotice?: { title: string; body: string; attribution?: string };
	onSaved: (saved: PersonalFood) => void;
	onCancel: () => void;
}) {
	const { t, locale } = useI18n();
	const personalFoods = usePersonalFoods();
	const toast = useToast();
	const initial = food ?? seed;
	const [nameEn, setNameEn] = useState(initial?.name.en ?? "");
	const [nameNl, setNameNl] = useState(initial?.name.nl ?? "");
	const [baseUnit, setBaseUnit] = useState<"g" | "ml">(
		initial?.baseUnit ?? "g",
	);
	const [nutrients, setNutrients] = useState(() => initialNutrients(initial));
	const [servings, setServings] = useState(() => initialServings(initial));
	const nextServingKey = useRef(servings.length);
	const [validationError, setValidationError] = useState<string>();
	const [saving, setSaving] = useState(false);

	/** The shipped record behind this food, when it is a correction of one. */
	const source = useMemo(
		() => (initial ? forkSource(initial) : undefined),
		[initial],
	);

	const stateOptions = useMemo(
		() => [
			{
				value: "absent" as const,
				label: t.nutrition.personalFood.states.absent,
			},
			{ value: "trace" as const, label: t.nutrition.personalFood.states.trace },
			{ value: "value" as const, label: t.nutrition.personalFood.states.value },
		],
		[t],
	);

	function buildDraft(): PersonalFoodDraft {
		const values = {} as Record<NutrientKey, NutrientValue>;
		for (const key of NUTRIENT_KEYS) {
			const input = nutrients[key];
			if (input.kind === "value") {
				const amount = parseNumber(input.amount);
				values[key] = { kind: "value", amount };
			} else {
				values[key] = { kind: input.kind };
			}
		}
		const editable: EditorSeed = {
			name: { en: nameEn, nl: nameNl },
			baseUnit,
			nutrients: values,
			servings: servings.map((serving) => ({
				label: { en: serving.en, nl: serving.nl },
				amount: parseNumber(serving.amount),
			})),
		};
		let provenance = initial?.provenance ?? {
			recordOrigin: "personal" as const,
			nutritionSource: "manual" as const,
			locallyEdited: false,
		};
		if (source) {
			// A fork of a shipped food is measured against the shipped record, and
			// `locallyEdited` is recomputed on every save rather than latched, so a
			// figure changed and changed back is honestly reported as unchanged (#75).
			provenance = {
				...provenance,
				locallyEdited: forkHasLocalEdits(editable, source),
			};
		} else if (!food && seed && !draftUnchanged(editable, seed)) {
			// A Food Import review that saves without touching anything stays an
			// unedited import; changing any field before saving is what earns
			// `locallyEdited: true` — the provenance the diary snapshot inherits
			// later has to say which happened (#76).
			provenance = { ...provenance, locallyEdited: true };
		}
		return { ...editable, provenance };
	}

	async function save() {
		if (saving) return;
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
			setSaving(false);
		}
	}

	return (
		<ScrollView
			style={styles.root}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			<AppText variant="title">
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
			<Card style={styles.disclosure}>
				<AppText variant="heading">
					{t.nutrition.personalFood.storageTitle}
				</AppText>
				<AppText variant="caption">
					{t.nutrition.personalFood.storageBody}
				</AppText>
			</Card>

			<LabeledInput
				label={t.nutrition.personalFood.nameEn}
				value={nameEn}
				onChangeText={setNameEn}
			/>
			<LabeledInput
				label={t.nutrition.personalFood.nameNl}
				value={nameNl}
				onChangeText={setNameNl}
			/>
			<AppText variant="label">{t.nutrition.personalFood.baseUnit}</AppText>
			<Segmented
				value={baseUnit}
				onChange={setBaseUnit}
				options={[
					{ value: "g", label: t.nutrition.personalFood.grams },
					{ value: "ml", label: t.nutrition.personalFood.millilitres },
				]}
			/>

			<AppText variant="heading">{t.nutrition.personalFood.per100}</AppText>
			{NUTRIENT_KEYS.map((key) => {
				const label = t.nutrition.nutrients[key];
				const input = nutrients[key];
				return (
					<View key={key} style={styles.nutrient}>
						<AppText variant="label">{label}</AppText>
						<Segmented
							value={input.kind}
							onChange={(kind) =>
								setNutrients((current) => ({
									...current,
									[key]: { ...current[key], kind },
								}))
							}
							options={stateOptions.map((option) => ({
								...option,
								accessibilityLabel: `${label}: ${option.label}`,
							}))}
						/>
						{input.kind === "value" ? (
							<TextInput
								value={input.amount}
								onChangeText={(amount) =>
									setNutrients((current) => ({
										...current,
										[key]: { ...current[key], amount },
									}))
								}
								accessibilityLabel={`${label} per 100 ${baseUnit}`}
								keyboardType="decimal-pad"
								style={styles.input}
							/>
						) : null}
					</View>
				);
			})}

			<View style={styles.sectionHeading}>
				<AppText variant="heading">{t.nutrition.personalFood.servings}</AppText>
				<AppText variant="caption">
					{t.nutrition.personalFood.servingsHelp}
				</AppText>
			</View>
			{servings.map((serving, index) => (
				<Card key={serving.key} style={styles.serving}>
					<LabeledInput
						label={`Serving ${index + 1} ${t.nutrition.personalFood.englishLabel}`}
						value={serving.en}
						onChangeText={(en) =>
							setServings((current) =>
								current.map((item, itemIndex) =>
									itemIndex === index ? { ...item, en } : item,
								),
							)
						}
					/>
					<LabeledInput
						label={`Serving ${index + 1} ${t.nutrition.personalFood.dutchLabel}`}
						value={serving.nl}
						onChangeText={(nl) =>
							setServings((current) =>
								current.map((item, itemIndex) =>
									itemIndex === index ? { ...item, nl } : item,
								),
							)
						}
					/>
					<LabeledInput
						label={`Serving ${index + 1} ${t.nutrition.personalFood.amountIn} ${baseUnit}`}
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
						label={t.nutrition.personalFood.removeServing}
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
					label={t.nutrition.personalFood.addServing}
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
			<GhostButton label={t.nutrition.personalFood.cancel} onPress={onCancel} />
		</ScrollView>
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
	content: { padding: 20, paddingBottom: 48, gap: spacing.md },
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
	nutrient: { gap: spacing.sm },
	sectionHeading: { gap: spacing.xs },
	serving: { gap: spacing.sm },
	error: { color: colors.danger },
});
