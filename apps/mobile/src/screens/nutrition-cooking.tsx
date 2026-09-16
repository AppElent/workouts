import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { nutritionCookingCopy } from "../data/nutrition-cooking-copy";
import {
	type CaptureDraft,
	type NutritionCookingRepository,
	openNutritionCookingRepository,
} from "../data/nutrition-cooking-repository";
import { MEAL_SLOTS, type MealSlot } from "../data/nutrition-day";
import {
	oneOffLogSnapshot,
	positiveOneOffNumber,
} from "../data/nutrition-one-off";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../data/nutrition-operation-service";
import { useI18n } from "../i18n";
import { colors, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { useConfirm } from "../ui/confirm-dialog";
import { EmptyState } from "../ui/empty-state";
import { FormTextField } from "../ui/form";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

type ScreenProps = {
	readonly date: string;
	readonly meal: MealSlot;
	readonly repository?: NutritionCookingRepository;
	/** Route intent from the food browser; the hub remains the default. */
	readonly initialMode?: Exclude<Mode, "hub">;
};

type Mode = "hub" | "draft-new" | "draft-edit" | "draft-log" | "oneoff-log";

const EMPTY_NUTRIENT_INPUTS = Object.fromEntries(
	NUTRIENT_KEYS.map((key) => [key, ""]),
) as Record<NutrientKey, string>;

function mealLabel(meal: MealSlot, locale: "en" | "nl") {
	const names = {
		breakfast: { en: "Breakfast", nl: "Ontbijt" },
		lunch: { en: "Lunch", nl: "Lunch" },
		dinner: { en: "Dinner", nl: "Diner" },
		snacks: { en: "Snacks", nl: "Tussendoortjes" },
	};
	return names[meal][locale];
}

function parseOptionalNutrient(value: string, label: string): number {
	const parsed = Number(value.replace(",", ".").trim());
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new Error(`${label} must be zero or greater.`);
	}
	return parsed;
}

export function NutritionCookingScreen({
	date,
	meal,
	repository: suppliedRepository,
	initialMode,
}: ScreenProps) {
	const { locale, t } = useI18n();
	const copy = nutritionCookingCopy(locale);
	const operations = useNutritionOperations();
	const toast = useToast();
	const confirm = useConfirm();
	const ownsRepository = suppliedRepository === undefined;
	const [repository] = useState(
		() =>
			suppliedRepository ?? openNutritionCookingRepository(mintNutritionUuid),
	);
	const [, setRevision] = useState(0);
	const [mode, setMode] = useState<Mode>(() => initialMode ?? "hub");
	const [selectedDraftId, setSelectedDraftId] = useState<string>();
	const bump = () => setRevision((value) => value + 1);

	useEffect(() => {
		if (!ownsRepository) return;
		return () => repository.close();
	}, [ownsRepository, repository]);

	const subject = operations.getSubject();
	const drafts = repository.listDrafts(subject ?? "");

	if (!subject) {
		return <EmptyState body={copy.storageBody} />;
	}

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
		>
			{mode === "hub" ? (
				<Hub
					copy={copy}
					locale={locale}
					drafts={drafts}
					onNewDraft={() => setMode("draft-new")}
					onLogOnce={() => setMode("oneoff-log")}
					onEditDraft={(id) => {
						setSelectedDraftId(id);
						setMode("draft-edit");
					}}
					onLogDraft={(draft) => {
						setSelectedDraftId(draft.id);
						setMode("draft-log");
					}}
					onDeleteDraft={async (id) => {
						const approved = await confirm({
							title: copy.deleteDraftTitle,
							message: copy.deleteDraftBody,
							confirmLabel: copy.deleteDraftConfirm,
							cancelLabel: copy.cancel,
							destructive: true,
						});
						if (!approved) return;
						try {
							if (repository.removeDraft(subject, id)) bump();
						} catch {
							toast.error(copy.draftSaveFailure);
						}
					}}
				/>
			) : mode === "draft-new" ? (
				<DraftEditor
					copy={copy}
					locale={locale}
					date={date}
					meal={meal}
					onCancel={() => setMode("hub")}
					onSaved={() => {
						bump();
						setMode("hub");
					}}
					repository={repository}
					subject={subject}
					toast={toast}
				/>
			) : mode === "draft-edit" ? (
				<DraftEditor
					copy={copy}
					locale={locale}
					draft={drafts.find((draft) => draft.id === selectedDraftId)}
					date={date}
					meal={meal}
					onCancel={() => setMode("hub")}
					onSaved={() => {
						bump();
						setMode("hub");
					}}
					repository={repository}
					subject={subject}
					toast={toast}
				/>
			) : mode === "oneoff-log" ? (
				<DraftLogger
					copy={copy}
					locale={locale}
					date={date}
					meal={meal}
					operations={operations}
					repository={repository}
					labels={t.nutrition.nutrients}
					toast={toast}
					onAccepted={() => {
						bump();
						setMode("hub");
					}}
					onCancel={() => setMode("hub")}
				/>
			) : (
				<DraftLogger
					copy={copy}
					locale={locale}
					date={date}
					meal={meal}
					draft={drafts.find((draft) => draft.id === selectedDraftId)}
					operations={operations}
					repository={repository}
					labels={t.nutrition.nutrients}
					toast={toast}
					onAccepted={() => {
						bump();
						setMode("hub");
					}}
					onCancel={() => setMode("hub")}
				/>
			)}
		</ScrollView>
	);
}

function Hub({
	copy,
	locale,
	drafts,
	onNewDraft,
	onLogOnce,
	onEditDraft,
	onLogDraft,
	onDeleteDraft,
}: {
	copy: ReturnType<typeof nutritionCookingCopy>;
	locale: "en" | "nl";
	drafts: readonly CaptureDraft[];
	onNewDraft: () => void;
	onLogOnce: () => void;
	onEditDraft: (id: string) => void;
	onLogDraft: (draft: CaptureDraft) => void;
	onDeleteDraft: (id: string) => Promise<void>;
}) {
	return (
		<>
			<Eyebrow>{copy.title}</Eyebrow>
			<AppText variant="title">{copy.title}</AppText>
			<Card style={styles.storageDisclosure}>
				<AppText variant="heading">{copy.storageTitle}</AppText>
				<AppText variant="caption">{copy.storageBody}</AppText>
			</Card>
			<View style={styles.actions}>
				<PrimaryButton label={copy.captureNote} onPress={onNewDraft} />
				<GhostButton label={copy.logOnce} onPress={onLogOnce} />
			</View>
			<AppText variant="heading">{copy.unfinished}</AppText>
			{drafts.length === 0 ? (
				<EmptyState body={copy.noDrafts} />
			) : (
				<Card>
					{drafts.map((draft) => (
						<View key={draft.id} style={styles.draftRow}>
							<View style={styles.flex}>
								<AppText variant="body" style={styles.strong}>
									{draft.note}
								</AppText>
								<AppText variant="caption">
									{draft.date} · {mealLabel(draft.meal, locale)}
								</AppText>
							</View>
							<View style={styles.inlineActions}>
								<GhostButton
									label={copy.editDraft}
									onPress={() => onEditDraft(draft.id)}
								/>
								<GhostButton
									label={copy.convertDraft}
									onPress={() => onLogDraft(draft)}
								/>
								<GhostButton
									label={copy.deleteDraft}
									onPress={() => void onDeleteDraft(draft.id)}
								/>
							</View>
						</View>
					))}
				</Card>
			)}
		</>
	);
}

function DraftEditor({
	copy,
	locale,
	draft,
	date,
	meal,
	onCancel,
	onSaved,
	repository,
	subject,
	toast,
}: {
	copy: ReturnType<typeof nutritionCookingCopy>;
	locale: "en" | "nl";
	draft?: CaptureDraft;
	date: string;
	meal: MealSlot;
	onCancel: () => void;
	onSaved: () => void;
	repository: NutritionCookingRepository;
	subject: string;
	toast: {
		error: (message: string) => void;
		success: (message: string) => void;
	};
}) {
	const [note, setNote] = useState(draft?.note ?? "");
	const [selectedMeal, setSelectedMeal] = useState<MealSlot>(
		draft?.meal ?? meal,
	);
	const [saving, setSaving] = useState(false);
	const savingRef = useRef(false);
	function save() {
		if (savingRef.current) return;
		savingRef.current = true;
		setSaving(true);
		try {
			if (draft)
				repository.updateDraft(subject, draft.id, {
					date: draft.date,
					meal: selectedMeal,
					note,
				});
			else repository.createDraft(subject, { date, meal: selectedMeal, note });
			onSaved();
		} catch {
			toast.error(copy.draftSaveFailure);
			setSaving(false);
			savingRef.current = false;
		}
	}
	return (
		<>
			<AppText variant="title">{copy.captureNote}</AppText>
			<Field
				label={copy.notePlaceholder}
				value={note}
				onChangeText={setNote}
				multiline
			/>
			<AppText variant="label">{copy.meal}</AppText>
			<View style={styles.inlineActions}>
				{MEAL_SLOTS.map((slot) => (
					<GhostButton
						key={slot}
						label={mealLabel(slot, locale)}
						onPress={() => setSelectedMeal(slot)}
						style={selectedMeal === slot ? styles.selectedButton : undefined}
					/>
				))}
			</View>
			<View style={styles.actions}>
				<PrimaryButton
					label={saving ? copy.savingDraft : copy.saveDraft}
					onPress={save}
					disabled={!note.trim()}
					loading={saving}
				/>
				<GhostButton label={copy.cancel} onPress={onCancel} disabled={saving} />
			</View>
		</>
	);
}

function DraftLogger({
	copy,
	locale,
	draft,
	date,
	meal,
	operations,
	repository,
	labels,
	toast,
	onAccepted,
	onCancel,
}: {
	copy: ReturnType<typeof nutritionCookingCopy>;
	locale: "en" | "nl";
	draft?: CaptureDraft;
	date: string;
	meal: MealSlot;
	operations: ReturnType<typeof useNutritionOperations>;
	repository: NutritionCookingRepository;
	labels: Readonly<Record<NutrientKey, string>>;
	toast: { error: (message: string) => void };
	onAccepted: () => void;
	onCancel: () => void;
}) {
	const [nameEn, setNameEn] = useState(draft?.note ?? "");
	const [nameNl, setNameNl] = useState(draft?.note ?? "");
	const [amount, setAmount] = useState("");
	const [baseUnit, setBaseUnit] = useState<"g" | "ml" | "serving">("serving");
	const [nutrientInputs, setNutrientInputs] = useState(EMPTY_NUTRIENT_INPUTS);
	const [logging, setLogging] = useState(false);
	const loggingRef = useRef(false);
	function log() {
		if (loggingRef.current) return;
		const subject = operations.getSubject();
		if (!subject) return;
		try {
			const numericAmount = positiveOneOffNumber(amount, copy.amount);
			const nutrients: Partial<Record<NutrientKey, NutrientValue>> = {};
			for (const key of NUTRIENT_KEYS) {
				if (!nutrientInputs[key].trim()) continue;
				const value = parseOptionalNutrient(nutrientInputs[key], key);
				nutrients[key] = { kind: "value", amount: value };
			}
			const draftId = draft?.id;
			const persistedDraft = draftId
				? repository.getDraft(subject, draftId)
				: undefined;
			const conversionDraft = persistedDraft ?? draft;
			if (conversionDraft?.conversionClientEntryId) {
				const alreadyAccepted = operations
					.getOperations(subject)
					.some((operation) => {
						const operationValue = operation.envelope.operation;
						return operationValue.kind === "create"
							? operationValue.entry.clientEntryId ===
									conversionDraft.conversionClientEntryId
							: operationValue.kind === "createBatch"
								? operationValue.entries.some(
										(entry) =>
											entry.clientEntryId ===
											conversionDraft.conversionClientEntryId,
									)
								: false;
					});
				if (alreadyAccepted) {
					if (draftId) repository.removeDraft(subject, draftId);
					onAccepted();
					return;
				}
			}
			loggingRef.current = true;
			setLogging(true);
			const marked = draftId
				? repository.beginDraftConversion(subject, draftId, mintNutritionUuid())
				: undefined;
			const snapshot = oneOffLogSnapshot({
				date: marked?.date ?? conversionDraft?.date ?? date,
				meal: marked?.meal ?? conversionDraft?.meal ?? meal,
				name: { en: nameEn.trim(), nl: nameNl.trim() },
				amount: numericAmount,
				baseUnit,
				nutrients,
				clientEntryId: marked?.conversionClientEntryId ?? mintNutritionUuid(),
			});
			const operationId = operations.create(subject, snapshot, undefined, () =>
				toast.error(copy.conversionFailure),
			);
			if (draftId) {
				repository.setDraftConversionOperation(subject, draftId, operationId);
				// create() returns only after release-two SQLite acceptance.
				repository.removeDraft(subject, draftId);
			}
			onAccepted();
		} catch {
			toast.error(copy.conversionFailure);
			setLogging(false);
			loggingRef.current = false;
		}
	}
	return (
		<>
			<AppText variant="title">{copy.logOnce}</AppText>
			<AppText variant="caption">
				{draft?.date ?? date} · {mealLabel(draft?.meal ?? meal, locale)}
			</AppText>
			<Field
				label={copy.oneOffFoodNameEn}
				value={nameEn}
				onChangeText={setNameEn}
			/>
			<Field
				label={copy.oneOffFoodNameNl}
				value={nameNl}
				onChangeText={setNameNl}
			/>
			<Field
				label={copy.amount}
				value={amount}
				onChangeText={setAmount}
				keyboardType="decimal-pad"
			/>
			<View style={styles.inlineActions}>
				<GhostButton
					label={copy.servings}
					onPress={() => setBaseUnit("serving")}
					style={baseUnit === "serving" ? styles.selectedButton : undefined}
				/>
				<GhostButton
					label={copy.grams}
					onPress={() => setBaseUnit("g")}
					style={baseUnit === "g" ? styles.selectedButton : undefined}
				/>
				<GhostButton
					label={copy.millilitres}
					onPress={() => setBaseUnit("ml")}
					style={baseUnit === "ml" ? styles.selectedButton : undefined}
				/>
			</View>
			<AppText variant="caption">{copy.estimated}</AppText>
			<AppText variant="caption">{copy.nutrientAmountHelp}</AppText>
			{NUTRIENT_KEYS.map((key) => (
				<Field
					key={key}
					label={labels[key]}
					value={nutrientInputs[key]}
					onChangeText={(value) =>
						setNutrientInputs((current) => ({ ...current, [key]: value }))
					}
					keyboardType="decimal-pad"
				/>
			))}
			<PrimaryButton
				label={copy.convertDraft}
				onPress={log}
				disabled={!nameEn.trim() || !nameNl.trim() || !amount.trim()}
				loading={logging}
			/>
			<GhostButton label={copy.cancel} onPress={onCancel} disabled={logging} />
		</>
	);
}

function Field({
	label,
	value,
	onChangeText,
	keyboardType,
	multiline,
}: {
	label: string;
	value: string;
	onChangeText: (value: string) => void;
	keyboardType?: "decimal-pad";
	multiline?: boolean;
}) {
	return (
		<FormTextField
			label={label}
			value={value}
			onChangeText={onChangeText}
			keyboardType={keyboardType}
			multiline={multiline}
		/>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: spacing.md },
	flex: { flex: 1 },
	strong: { fontWeight: "700" },
	storageDisclosure: { gap: spacing.xs },
	actions: { gap: spacing.sm },
	inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
	draftRow: { gap: spacing.sm, paddingVertical: spacing.sm },
	selectedButton: {
		borderColor: colors.accent,
		backgroundColor: colors.accentDim,
	},
});
