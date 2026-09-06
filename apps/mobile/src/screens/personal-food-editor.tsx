import {
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
import { useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card } from "../ui/coach";
import { Segmented } from "../ui/segmented";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

type NutrientInput = { kind: NutrientValue["kind"]; amount: string };
type ServingInput = { key: string; en: string; nl: string; amount: string };

function initialNutrients(
	food?: PersonalFood,
): Record<NutrientKey, NutrientInput> {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => {
			const value = food?.nutrients[key] ?? { kind: "absent" as const };
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

function initialServings(food?: PersonalFood): ServingInput[] {
	return (
		food?.servings.map((serving, index) => ({
			key: `existing-${index}`,
			en: serving.label.en,
			nl: serving.label.nl,
			amount: String(serving.amount),
		})) ?? []
	);
}

function parseNumber(text: string): number {
	return Number(text.trim().replace(",", "."));
}

export function PersonalFoodEditor({
	food,
	onSaved,
	onCancel,
}: {
	food?: PersonalFood;
	onSaved: (saved: PersonalFood) => void;
	onCancel: () => void;
}) {
	const { t } = useI18n();
	const personalFoods = usePersonalFoods();
	const toast = useToast();
	const [nameEn, setNameEn] = useState(food?.name.en ?? "");
	const [nameNl, setNameNl] = useState(food?.name.nl ?? "");
	const [baseUnit, setBaseUnit] = useState<"g" | "ml">(food?.baseUnit ?? "g");
	const [nutrients, setNutrients] = useState(() => initialNutrients(food));
	const [servings, setServings] = useState(() => initialServings(food));
	const nextServingKey = useRef(servings.length);
	const [validationError, setValidationError] = useState<string>();
	const [saving, setSaving] = useState(false);

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
		return {
			name: { en: nameEn, nl: nameNl },
			baseUnit,
			nutrients: values,
			servings: servings.map((serving) => ({
				label: { en: serving.en, nl: serving.nl },
				amount: parseNumber(serving.amount),
			})),
			provenance: food?.provenance ?? {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
		};
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
				{food
					? t.nutrition.personalFood.editTitle
					: t.nutrition.personalFood.createTitle}
			</AppText>
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
