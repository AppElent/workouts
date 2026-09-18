import { useForm } from "@tanstack/react-form";
import { formatQuantity } from "@workouts/core/nutrition";
import { useRef, useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { z } from "zod";
import { resolveComboPart, scaleComboSnapshot } from "../data/nutrition-combo";
import { nutritionComboCopy } from "../data/nutrition-combo-copy";
import type { DiaryEntry, MealSlot } from "../data/nutrition-day";
import { MEAL_SLOTS } from "../data/nutrition-day";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../data/nutrition-operation-service";
import type { ComboPartReference } from "../data/personal-food-repository";
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

type PartAdjustment = {
	included: boolean;
	scaleInput: string;
	scaleValue?: number;
};

function parsedScale(input: string): number {
	return input.trim() ? Number(input.replace(",", ".")) : 1;
}

function displayedScale(value: number, locale: "en" | "nl"): string {
	return new Intl.NumberFormat(locale, {
		useGrouping: false,
		maximumFractionDigits: 3,
	}).format(value);
}

export function NutritionComboBuilder({
	entries,
	date,
	meal,
	onSaved,
}: {
	entries: readonly DiaryEntry[];
	date: string;
	meal: MealSlot;
	onClose: () => void;
	onSaved: () => void;
}) {
	const { t, locale } = useI18n();
	const foods = usePersonalFoods();
	const operations = useNutritionOperations();
	const toast = useToast();
	const form = useForm({
		defaultValues: { name: "" },
		onSubmit: async ({ value }) => {
			const parsed = comboNameSchema.parse(value);
			try {
				// Yield a paint so synchronous SQLite work still has a visible pending state.
				await Promise.resolve();
				const subject = operations.getSubject();
				if (!subject) throw new Error("Not signed in.");
				const combo = foods.createCombo({
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
							...(entry.estimated ? { estimated: true as const } : {}),
						},
					})),
				});
				try {
					if (new Set(entries.map((entry) => entry.meal)).size > 1) {
						toast.success(t.nutrition.combos.saved);
						onSaved();
						return;
					}
					operations.group(
						subject,
						date,
						meal,
						entries.map((entry) => ({ kind: "serverId", id: entry.id })),
						{
							id: mintNutritionUuid(),
							comboId: combo.id,
							name: combo.name,
						},
					);
				} catch (error) {
					foods.removeCombo(combo.id);
					throw error;
				}
				toast.success(t.nutrition.combos.saved);
				onSaved();
			} catch {
				toast.error(t.nutrition.combos.saveFailure);
			}
		},
	});

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
		>
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
	selectedComboId,
	onSelectCombo,
	onBack,
	date,
	meal: initialMeal,
	onClose,
}: {
	date: string;
	meal: MealSlot;
	selectedComboId?: string;
	onSelectCombo: (id: string) => void;
	onBack: () => void;
	onClose: () => void;
}) {
	const { t, locale } = useI18n();
	const foods = usePersonalFoods();
	const operations = useNutritionOperations();
	const toast = useToast();
	const confirm = useConfirm();
	const [meal, setMeal] = useState<MealSlot>(initialMeal);
	const [scaleInput, setScaleInput] = useState("");
	const [scaleValue, setScaleValue] = useState<number>();
	const [logging, setLogging] = useState(false);
	const loggingRef = useRef(false);
	const [deleting, setDeleting] = useState(false);
	const combos = foods.listCombos();
	const selected = combos.find((combo) => combo.id === selectedComboId);
	const [partAdjustments, setPartAdjustments] = useState<
		Record<string, PartAdjustment>
	>(() =>
		Object.fromEntries(
			(selected?.parts ?? []).map((part) => [
				part.id,
				{ included: true, scaleInput: "" },
			]),
		),
	);
	const cookingCopy = nutritionComboCopy(locale);
	const scale = scaleValue ?? parsedScale(scaleInput);
	const scaleValid = Number.isFinite(scale) && scale > 0;
	const hasMissing =
		selected?.parts.some((part) => part.status === "missing") ?? false;
	const adjustedParts =
		selected?.parts.map((part) => {
			const adjustment = partAdjustments[part.id] ?? {
				included: true,
				scaleInput: "",
			};
			const partScale =
				adjustment.scaleValue ?? parsedScale(adjustment.scaleInput);
			const partScaleValid = Number.isFinite(partScale) && partScale > 0;
			const resolved =
				part.status === "available"
					? resolveComboPart(part, foods.find)
					: undefined;
			const previewSnapshot = resolved ?? part.snapshot;
			const preview =
				scaleValid && partScaleValid
					? scaleComboSnapshot(previewSnapshot, scale * partScale)
					: undefined;
			return {
				part,
				...adjustment,
				partScale,
				partScaleValid,
				preview,
			};
		}) ?? [];
	const includedParts = adjustedParts.filter((part) => part.included);
	const hasIncludedMissing = includedParts.some(
		({ part }) => part.status === "missing",
	);
	const adjustmentsValid = includedParts.every((part) => part.partScaleValid);

	async function log() {
		if (
			!selected ||
			hasIncludedMissing ||
			includedParts.length === 0 ||
			!scaleValid ||
			!adjustmentsValid ||
			loggingRef.current
		)
			return;
		loggingRef.current = true;
		setLogging(true);
		try {
			const subject = operations.getSubject();
			if (!subject) throw new Error("Not signed in.");
			const comboGroup = {
				id: mintNutritionUuid(),
				comboId: selected.id,
				name: selected.name,
			};
			operations.createBatch(
				subject,
				date,
				meal,
				includedParts.map(({ part, partScale }) => ({
					...scaleComboSnapshot(
						resolveComboPart(part, foods.find),
						scale * partScale,
					),
					date,
					meal,
					comboGroup,
					clientEntryId: mintNutritionUuid(),
				})),
				() => {
					toast.error(t.nutrition.combos.logFailure);
					setLogging(false);
					loggingRef.current = false;
				},
				() => onClose(),
			);
		} catch {
			toast.error(t.nutrition.combos.logFailure);
			setLogging(false);
			loggingRef.current = false;
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
			onBack();
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
			foods.updateCombo(selected.id, { name: selected.name, parts: remaining });
		} catch {
			toast.error(t.nutrition.combos.resolveFailure);
		}
	}

	function updatePart(partId: string, patch: Partial<PartAdjustment>) {
		setPartAdjustments((current) => ({
			...current,
			[partId]: {
				included: current[partId]?.included ?? true,
				scaleInput: current[partId]?.scaleInput ?? "",
				...patch,
			},
		}));
	}

	function commitPartScale(partId: string) {
		const adjustment = partAdjustments[partId];
		const input = adjustment?.scaleInput ?? "";
		const value = adjustment?.scaleValue ?? parsedScale(input);
		if (!input.trim() || !Number.isFinite(value) || value <= 0) return;
		updatePart(partId, {
			scaleInput: displayedScale(value, locale),
			scaleValue: value,
		});
	}

	function commitWholeScale() {
		const value = scaleValue ?? parsedScale(scaleInput);
		if (!scaleInput.trim() || !Number.isFinite(value) || value <= 0) return;
		setScaleValue(value);
		setScaleInput(displayedScale(value, locale));
	}

	function resetAdjustments() {
		setScaleInput("");
		setScaleValue(undefined);
		setPartAdjustments(
			Object.fromEntries(
				(selected?.parts ?? []).map((part) => [
					part.id,
					{ included: true, scaleInput: "" },
				]),
			),
		);
	}

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
		>
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
						{adjustedParts.map(
							({
								part,
								included,
								scaleInput: partInput,
								partScaleValid,
								preview,
							}) => {
								const name = part.snapshot.name[locale];
								return (
									<View key={part.id} style={styles.partRow}>
										<View style={styles.row}>
											<Pressable
												onPress={() =>
													updatePart(part.id, { included: !included })
												}
												accessibilityRole="checkbox"
												accessibilityState={{ checked: included }}
												accessibilityLabel={
													locale === "nl"
														? `${included ? "Sluit uit" : "Voeg toe"}: ${name}`
														: `${included ? "Exclude" : "Include"} ${name}`
												}
												style={styles.includeToggle}
											>
												<AppText
													style={{
														color: included ? colors.accent : colors.textMuted,
													}}
												>
													{included ? "☑" : "☐"}
												</AppText>
											</Pressable>
											<View style={styles.flex}>
												<AppText style={styles.strong}>{name}</AppText>
												<AppText
													variant="caption"
													style={
														part.status === "missing"
															? styles.missing
															: undefined
													}
												>
													{part.status === "missing"
														? t.nutrition.combos.missing
														: part.snapshot.serving[locale]}
												</AppText>
											</View>
										</View>
										<View style={styles.partControls}>
											<TextInput
												value={partInput}
												onChangeText={(value) =>
													updatePart(part.id, {
														scaleInput: value,
														scaleValue: undefined,
													})
												}
												onBlur={() => commitPartScale(part.id)}
												placeholder="1"
												keyboardType="decimal-pad"
												accessibilityLabel={
													locale === "nl" ? `Schaal ${name}` : `Scale ${name}`
												}
												style={[styles.input, styles.partInput]}
											/>
											<AppText
												variant="caption"
												style={!partScaleValid ? styles.missing : undefined}
											>
												{preview
													? `${locale === "nl" ? "Eindhoeveelheid" : "Final amount"}: ${formatQuantity(preview.amount, locale)} ${preview.baseUnit}`
													: cookingCopy.comboScaleInvalid}
											</AppText>
										</View>
									</View>
								);
							},
						)}
					</Card>
					<AppText variant="label">{cookingCopy.comboScale}</AppText>
					<TextInput
						value={scaleInput}
						onChangeText={(value) => {
							setScaleInput(value);
							setScaleValue(undefined);
						}}
						onBlur={commitWholeScale}
						placeholder="1"
						keyboardType="decimal-pad"
						accessibilityLabel={cookingCopy.comboScale}
						style={styles.input}
					/>
					<AppText variant="caption">
						{scaleValid
							? cookingCopy.comboScaleHelp
							: cookingCopy.comboScaleInvalid}
					</AppText>
					<GhostButton
						label={
							locale === "nl" ? "Aanpassingen herstellen" : "Reset adjustments"
						}
						onPress={resetAdjustments}
					/>
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
								: includedParts.length === 1
									? t.nutrition.combos.logOne
									: fmt(t.nutrition.combos.logMany, {
											count: includedParts.length,
										})
						}
						onPress={log}
						disabled={
							hasIncludedMissing ||
							includedParts.length === 0 ||
							deleting ||
							!scaleValid ||
							!adjustmentsValid
						}
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
							onPress={() => onSelectCombo(combo.id)}
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

/** Keep the stable Food reference, or the one-off snapshot. */
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
	partRow: {
		paddingVertical: spacing.sm,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
		gap: spacing.sm,
	},
	partControls: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingLeft: 44,
	},
	partInput: { width: 88 },
	includeToggle: {
		minWidth: 44,
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
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
