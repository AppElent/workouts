import { useMutation } from "convex/react";
import { useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { api } from "../convex/api";
import type { DiaryEntry, MealSlot } from "../data/nutrition-day";
import { MEAL_SLOTS } from "../data/nutrition-day";
import type {
	Combo,
	ComboPartReference,
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
	const [name, setName] = useState("");
	const [saving, setSaving] = useState(false);

	async function save() {
		if (!name.trim() || saving) return;
		setSaving(true);
		try {
			// Yield a paint so synchronous SQLite work still has a visible pending state.
			await Promise.resolve();
			foods.createCombo({
				name,
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
		} finally {
			setSaving(false);
		}
	}

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
			<TextInput
				value={name}
				onChangeText={setName}
				accessibilityLabel={t.nutrition.combos.name}
				style={styles.input}
				autoFocus
			/>
			<Card>
				{entries.map((entry) => (
					<View key={entry.id} style={styles.row}>
						<AppText style={styles.flex}>{entry.name[locale]}</AppText>
						<AppText variant="caption">{entry.serving[locale]}</AppText>
					</View>
				))}
			</Card>
			<PrimaryButton
				label={saving ? t.nutrition.combos.saving : t.nutrition.combos.save}
				onPress={save}
				disabled={!name.trim()}
				loading={saving}
			/>
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
				parts: selected.parts.map((part) => part.snapshot),
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
		try {
			foods.removeCombo(selected.id);
			setSelected(undefined);
		} catch {
			toast.error(t.nutrition.combos.deleteFailure);
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
						disabled={hasMissing}
						loading={logging}
					/>
					<GhostButton label={t.nutrition.combos.delete} onPress={remove} />
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
