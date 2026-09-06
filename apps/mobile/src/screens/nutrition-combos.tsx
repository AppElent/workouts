import { useForm } from "@tanstack/react-form";
import {
	getShippedFood,
	NUTRIENT_KEYS,
	type NutrientValue,
	shippedLibraryMeta,
} from "@workouts/core/nutrition";
import { useMutation } from "convex/react";
import { useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { z } from "zod";
import { api } from "../convex/api";
import type { DiaryEntry, MealSlot } from "../data/nutrition-day";
import { MEAL_SLOTS } from "../data/nutrition-day";
import type {
	Combo,
	ComboPart,
	ComboPartReference,
	ComboPartSnapshot,
	PersonalFood,
} from "../data/personal-food-repository";
import { usePersonalFoods } from "../data/personal-foods";
import { fmt, useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { useConfirm } from "../ui/confirm-dialog";
import { EmptyState } from "../ui/empty-state";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

const comboNameSchema = z.object({ name: z.string().trim().min(1) });

export function NutritionComboBuilder({
	entries,
	onClose,
	onSaved,
}: {
	entries: readonly DiaryEntry[];
	onClose: () => void;
	onSaved: () => void;
}) {
	const { t, locale } = useI18n();
	const foods = usePersonalFoods();
	const toast = useToast();
	const form = useForm({
		defaultValues: { name: "" },
		onSubmit: async ({ value }) => {
			const parsed = comboNameSchema.parse(value);
			try {
				// Yield a paint so synchronous SQLite work still has a visible pending state.
				await Promise.resolve();
				foods.createCombo({
					name: parsed.name,
					parts: entries.map((entry) => ({
						reference: referenceFor(entry),
						snapshot: {
							name: entry.name,
							serving: entry.serving,
							quantity: entry.quantity,
							amount: entry.amount,
							baseUnit: entry.baseUnit,
							nutrients: entry.nutrients,
							provenance: entry.provenance,
						},
					})),
				});
				toast.success(t.nutrition.combos.saved);
				onSaved();
			} catch {
				toast.error(t.nutrition.combos.saveFailure);
			}
		},
	});

	return (
		<ScrollView style={styles.root} contentContainerStyle={styles.content}>
			<Header label={t.common.back} onPress={onClose} />
			<Eyebrow>{t.nutrition.title}</Eyebrow>
			<AppText variant="title">{t.nutrition.combos.create}</AppText>
			<Card style={styles.storageDisclosure}>
				<AppText variant="heading">{t.nutrition.combos.storageTitle}</AppText>
				<AppText variant="caption">{t.nutrition.combos.storageBody}</AppText>
			</Card>
			<AppText variant="label">{t.nutrition.combos.name}</AppText>
			<form.Field name="name">
				{(field) => (
					<TextInput
						value={field.state.value}
						onChangeText={field.handleChange}
						accessibilityLabel={t.nutrition.combos.name}
						style={styles.input}
						autoFocus
					/>
				)}
			</form.Field>
			<Card>
				{entries.map((entry) => (
					<View key={entry.id} style={styles.row}>
						<AppText style={styles.flex}>{entry.name[locale]}</AppText>
						<AppText variant="caption">{entry.serving[locale]}</AppText>
					</View>
				))}
			</Card>
			<form.Subscribe
				selector={(state) => [state.values.name, state.isSubmitting] as const}
			>
				{([name, saving]) => (
					<PrimaryButton
						label={saving ? t.nutrition.combos.saving : t.nutrition.combos.save}
						onPress={() => void form.handleSubmit()}
						disabled={!name.trim()}
						loading={saving}
					/>
				)}
			</form.Subscribe>
		</ScrollView>
	);
}

export function NutritionComboLibrary({
	date,
	onClose,
}: {
	date: string;
	onClose: () => void;
}) {
	const { t, locale } = useI18n();
	const foods = usePersonalFoods();
	const toast = useToast();
	const confirm = useConfirm();
	const logCombo = useMutation(api.nutritionDiary.logCombo);
	const [selected, setSelected] = useState<Combo>();
	const [meal, setMeal] = useState<MealSlot>("breakfast");
	const [logging, setLogging] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const combos = foods.listCombos();
	const hasMissing =
		selected?.parts.some((part) => part.status === "missing") ?? false;

	async function log() {
		if (!selected || hasMissing || logging) return;
		setLogging(true);
		try {
			await logCombo({
				date,
				meal,
				combo: { id: selected.id, name: selected.name },
				parts: selected.parts.map((part) => resolvePart(part, foods.find)),
			});
			onClose();
		} catch {
			toast.error(t.nutrition.combos.logFailure);
			setLogging(false);
		}
	}

	async function remove() {
		if (!selected) return;
		const approved = await confirm({
			title: t.nutrition.combos.deleteTitle,
			message: t.nutrition.combos.deleteBody,
			confirmLabel: t.nutrition.combos.delete,
			cancelLabel: t.nutrition.combos.cancel,
			destructive: true,
		});
		if (!approved) return;
		setDeleting(true);
		try {
			await Promise.resolve();
			if (!foods.removeCombo(selected.id)) {
				throw new Error("Combo not found.");
			}
			setSelected(undefined);
		} catch {
			toast.error(t.nutrition.combos.deleteFailure);
		} finally {
			setDeleting(false);
		}
	}

	async function removeMissingParts() {
		if (!selected) return;
		const remaining = selected.parts.filter(
			(part) => part.status === "available",
		);
		if (remaining.length === 0) return;
		const approved = await confirm({
			title: t.nutrition.combos.resolveTitle,
			message: t.nutrition.combos.resolveBody,
			confirmLabel: t.nutrition.combos.resolve,
			cancelLabel: t.nutrition.combos.cancel,
			destructive: true,
		});
		if (!approved) return;
		try {
			setSelected(
				foods.updateCombo(selected.id, {
					name: selected.name,
					parts: remaining,
				}),
			);
		} catch {
			toast.error(t.nutrition.combos.resolveFailure);
		}
	}

	return (
		<ScrollView style={styles.root} contentContainerStyle={styles.content}>
			<Header
				label={t.common.back}
				onPress={() => (selected ? setSelected(undefined) : onClose())}
			/>
			<Eyebrow>{t.nutrition.title}</Eyebrow>
			<AppText variant="title">{t.nutrition.combos.log}</AppText>
			<Card style={styles.storageDisclosure}>
				<AppText variant="heading">{t.nutrition.combos.storageTitle}</AppText>
				<AppText variant="caption">{t.nutrition.combos.storageBody}</AppText>
			</Card>
			{selected ? (
				<>
					<AppText variant="heading">{selected.name}</AppText>
					{hasMissing ? (
						<Card style={styles.warning}>
							<AppText variant="heading">
								{t.nutrition.combos.needsAttention}
							</AppText>
							<AppText variant="caption">
								{t.nutrition.combos.missingBody}
							</AppText>
						</Card>
					) : null}
					<Card>
						{selected.parts.map((part) => (
							<View key={part.id} style={styles.row}>
								<AppText style={styles.flex}>
									{part.snapshot.name[locale]}
								</AppText>
								<AppText
									variant="caption"
									style={part.status === "missing" ? styles.missing : undefined}
								>
									{part.status === "missing"
										? t.nutrition.combos.missing
										: part.snapshot.serving[locale]}
								</AppText>
							</View>
						))}
					</Card>
					<AppText variant="label">{t.nutrition.combos.destination}</AppText>
					<View style={styles.meals}>
						{MEAL_SLOTS.map((slot) => (
							<Pressable
								key={slot}
								onPress={() => setMeal(slot)}
								accessibilityRole="radio"
								accessibilityState={{ checked: meal === slot }}
								style={[styles.meal, meal === slot && styles.mealSelected]}
							>
								<AppText>{t.nutrition.meals[slot]}</AppText>
							</Pressable>
						))}
					</View>
					<PrimaryButton
						label={
							logging
								? t.nutrition.combos.logging
								: selected.parts.length === 1
									? t.nutrition.combos.logOne
									: fmt(t.nutrition.combos.logMany, {
											count: selected.parts.length,
										})
						}
						onPress={log}
						disabled={hasMissing || deleting}
						loading={logging}
					/>
					<GhostButton
						label={
							deleting ? t.nutrition.combos.deleting : t.nutrition.combos.delete
						}
						onPress={remove}
						loading={deleting}
						disabled={logging}
					/>
					{hasMissing &&
					selected.parts.some((part) => part.status === "available") ? (
						<GhostButton
							label={t.nutrition.combos.resolve}
							onPress={removeMissingParts}
						/>
					) : null}
				</>
			) : combos.length === 0 ? (
				<EmptyState
					title={t.nutrition.combos.emptyTitle}
					body={t.nutrition.combos.emptyBody}
				/>
			) : (
				<Card>
					{combos.map((combo) => (
						<Pressable
							key={combo.id}
							onPress={() => setSelected(combo)}
							accessibilityRole="button"
							style={styles.row}
						>
							<View style={styles.flex}>
								<AppText style={styles.strong}>{combo.name}</AppText>
								<AppText variant="caption">
									{combo.parts.length === 1
										? t.nutrition.combos.partsOne
										: fmt(t.nutrition.combos.partsMany, {
												count: combo.parts.length,
											})}
								</AppText>
							</View>
							<AppText variant="heading">›</AppText>
						</Pressable>
					))}
				</Card>
			)}
		</ScrollView>
	);
}

function referenceFor(entry: DiaryEntry): ComboPartReference {
	if (entry.provenance.source === "shipped") {
		return { kind: "shipped", foodId: entry.provenance.sourceId };
	}
	if (
		entry.provenance.source === "personal" ||
		entry.provenance.source === "import"
	) {
		return { kind: "personal", foodId: entry.provenance.sourceId };
	}
	return { kind: "oneOff" };
}

/** Resolve only the same stable source id at log time; never search for a substitute. */
function resolvePart(
	part: ComboPart,
	findPersonalFood: (id: string) => PersonalFood | undefined,
): ComboPartSnapshot {
	if (part.reference.kind === "oneOff") return part.snapshot;
	const amount = part.snapshot.amount;
	if (part.reference.kind === "shipped") {
		const food = getShippedFood(part.reference.foodId);
		if (!food) throw new Error("Combo source is missing.");
		const meta = shippedLibraryMeta();
		return {
			...part.snapshot,
			name: food.name,
			baseUnit: food.baseUnit,
			nutrients: scaledNutrients(food.nutrients, amount),
			provenance: {
				source: "shipped",
				sourceId: food.id,
				dataset: meta.dataset.name,
				edition: meta.dataset.edition,
				sourceCode: food.code,
				sourceName: food.sourceName,
				saltDerived: true,
			},
		};
	}
	const food = findPersonalFood(part.reference.foodId);
	if (!food) throw new Error("Combo source is missing.");
	return {
		...part.snapshot,
		name: food.name,
		baseUnit: food.baseUnit,
		nutrients: scaledNutrients(food.nutrients, amount),
		provenance: {
			source: food.provenance.recordOrigin,
			sourceId: food.id,
			nutritionSource: food.provenance.nutritionSource,
			locallyEdited: food.provenance.locallyEdited,
			...(food.provenance.forkedFrom
				? { forkedFrom: food.provenance.forkedFrom }
				: {}),
			...(food.provenance.provider
				? { provider: food.provenance.provider }
				: {}),
			...(food.provenance.barcode ? { barcode: food.provenance.barcode } : {}),
			...(food.provenance.attribution
				? { attribution: food.provenance.attribution }
				: {}),
		},
	};
}

function scaledNutrients(
	per100: Readonly<Record<string, NutrientValue>>,
	amount: number,
): Record<(typeof NUTRIENT_KEYS)[number], NutrientValue> {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => {
			const value = per100[key];
			return [
				key,
				value.kind === "value"
					? { kind: "value", amount: value.amount * (amount / 100) }
					: { kind: value.kind },
			];
		}),
	) as Record<(typeof NUTRIENT_KEYS)[number], NutrientValue>;
}

function Header({ label, onPress }: { label: string; onPress: () => void }) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			style={styles.back}
		>
			<AppText variant="heading" style={{ color: colors.accent }}>
				‹
			</AppText>
			<AppText>{label}</AppText>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: spacing.md },
	flex: { flex: 1 },
	strong: { fontWeight: "700" },
	back: {
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	storageDisclosure: { gap: spacing.xs },
	warning: { gap: spacing.xs, borderColor: colors.warn },
	missing: { color: colors.danger },
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
	row: {
		minHeight: 52,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingVertical: spacing.sm,
	},
	meals: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
	meal: {
		minHeight: 44,
		justifyContent: "center",
		paddingHorizontal: spacing.md,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: radius.pill,
	},
	mealSelected: {
		borderColor: colors.accent,
		backgroundColor: colors.accentDim,
	},
});
