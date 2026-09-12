import type { NutrientKey } from "@workouts/core/nutrition";
import { NUTRIENT_KEYS, shippedLibrary } from "@workouts/core/nutrition";
import { useMemo, useRef, useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { formatLongDate } from "../data/calendar-day";
import {
	type AssistanceFood,
	type AssistanceRow,
	assistanceInputError,
	buildAssistanceBatchEntries,
	buildAssistanceFoodCatalog,
	editableLabelNutrients,
	nutrientsFromLabelInputs,
	parseNutritionLabel,
	parseTextAssistedLog,
	personalFoodDraftFromLabel,
	reparseAssistanceRow,
	selectAssistanceFood,
} from "../data/nutrition-assistance";
import type { MealSlot } from "../data/nutrition-day";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../data/nutrition-operation-service";
import { usePersonalFoods } from "../data/personal-foods";
import { fmt, useI18n } from "../i18n";
import { getNutritionAssistanceMessages } from "../i18n/messages/nutrition-assistance";
import { colors, radius, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { EmptyState } from "../ui/empty-state";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

const NUTRIENT_LABELS: Record<NutrientKey, { en: string; nl: string }> = {
	energy: { en: "Energy", nl: "Energie" },
	protein: { en: "Protein", nl: "Eiwitten" },
	carbs: { en: "Carbohydrates", nl: "Koolhydraten" },
	fat: { en: "Fat", nl: "Vet" },
	saturatedFat: { en: "Saturated fat", nl: "Verzadigd vet" },
	fibre: { en: "Fibre", nl: "Vezels" },
	sugars: { en: "Sugars", nl: "Suikers" },
	salt: { en: "Salt", nl: "Zout" },
};

export function NutritionAssistanceScreen({
	date,
	meal,
	onClose,
}: {
	date: string;
	meal: MealSlot;
	onClose: () => void;
}) {
	const { locale } = useI18n();
	const messages = getNutritionAssistanceMessages(locale);
	const personalFoods = usePersonalFoods();
	const operations = useNutritionOperations();
	const toast = useToast();
	const [mode, setMode] = useState<"text" | "label">("text");
	const [text, setText] = useState("");
	const [textError, setTextError] = useState<string>();
	const [rows, setRows] = useState<readonly AssistanceRow[]>([]);
	const [reviewingBatch, setReviewingBatch] = useState(false);
	const [batchSaving, setBatchSaving] = useState(false);
	const [batchAccepted, setBatchAccepted] = useState(false);
	const batchSubmitRef = useRef(false);
	const [labelText, setLabelText] = useState("");
	const [label, setLabel] = useState<ReturnType<typeof parseNutritionLabel>>();
	const [labelNames, setLabelNames] = useState({ en: "", nl: "" });
	const [labelUnit, setLabelUnit] = useState<"g" | "ml">("g");
	const [labelInputs, setLabelInputs] = useState<Record<NutrientKey, string>>(
		() =>
			editableLabelNutrients({
				energy: { kind: "absent" },
				protein: { kind: "absent" },
				carbs: { kind: "absent" },
				fat: { kind: "absent" },
				saturatedFat: { kind: "absent" },
				fibre: { kind: "absent" },
				sugars: { kind: "absent" },
				salt: { kind: "absent" },
			}),
	);
	const [portionText, setPortionText] = useState("100");
	const [labelSaving, setLabelSaving] = useState(false);
	const [labelAccepted, setLabelAccepted] = useState(false);
	const labelSubmitRef = useRef(false);
	const savedLabelFoodRef = useRef<
		| { intent: string; food: ReturnType<typeof personalFoods.create> }
		| undefined
	>(undefined);
	const catalog = useMemo(
		() =>
			buildAssistanceFoodCatalog(shippedLibrary().active, personalFoods.list()),
		[personalFoods],
	);

	const context = fmt(messages.context, {
		meal: mealLabel(meal, locale),
		date: formatLongDate(date, locale),
	});

	function parseTextInput() {
		const inputError = assistanceInputError(text);
		if (inputError) {
			setTextError(
				inputError === "too-long" ? messages.tooLong : messages.tooManyRows,
			);
			setRows([]);
			setReviewingBatch(false);
			return;
		}
		setTextError(undefined);
		setRows(parseTextAssistedLog(text, catalog, locale));
		setReviewingBatch(false);
		setBatchAccepted(false);
	}

	function chooseRow(rowId: string, candidateId: string) {
		setRows((current) =>
			current.map((row) =>
				row.id === rowId ? selectAssistanceFood(row, candidateId) : row,
			),
		);
	}

	function saveBatch() {
		if (batchSubmitRef.current || batchAccepted) return;
		const subject = operations.getSubject();
		if (!subject) {
			toast.error(messages.batchFailure);
			return;
		}
		batchSubmitRef.current = true;
		setBatchSaving(true);
		try {
			const entries = buildAssistanceBatchEntries(
				rows,
				date,
				meal,
				mintNutritionUuid,
			);
			operations.createBatch(
				subject,
				date,
				meal,
				entries,
				() => {
					batchSubmitRef.current = false;
					setBatchSaving(false);
					toast.error(messages.batchFailure);
				},
				() => {
					batchSubmitRef.current = false;
					setBatchSaving(false);
					setBatchAccepted(true);
				},
			);
		} catch {
			batchSubmitRef.current = false;
			setBatchSaving(false);
			toast.error(messages.batchFailure);
		}
	}

	function parseLabelInput() {
		const parsed = parseNutritionLabel(labelText);
		if (!parsed) {
			setLabel(undefined);
			toast.error(messages.invalidLabel);
			return;
		}
		setLabel(parsed);
		setLabelNames(parsed.name);
		setLabelUnit(parsed.baseUnit);
		setLabelInputs(editableLabelNutrients(parsed.nutrients));
		setLabelAccepted(false);
	}

	function saveLabelFood() {
		if (labelSubmitRef.current || labelAccepted) return;
		const subject = operations.getSubject();
		if (!subject || !label) {
			toast.error(messages.labelFailure);
			return;
		}
		const portion = Number(portionText.trim().replace(",", "."));
		if (!Number.isFinite(portion) || portion <= 0) {
			toast.error(messages.labelFailure);
			return;
		}
		labelSubmitRef.current = true;
		setLabelSaving(true);
		try {
			const nutrients = nutrientsFromLabelInputs(labelInputs);
			const intent = JSON.stringify({ labelNames, labelUnit, labelInputs });
			const saved =
				savedLabelFoodRef.current?.intent === intent
					? savedLabelFoodRef.current.food
					: personalFoods.create(
							personalFoodDraftFromLabel(
								label,
								labelNames,
								nutrients,
								labelUnit,
							),
						);
			savedLabelFoodRef.current = { intent, food: saved };
			const candidate = buildAssistanceFoodCatalog(
				[],
				[saved],
			)[0] as AssistanceFood;
			const row = parseTextAssistedLog(
				`${portionText} ${labelUnit} ${saved.name.en}`,
				[candidate],
				"en",
			)[0];
			if (!row) throw new Error("Label portion could not be prepared.");
			const selected = selectAssistanceFood(row, saved.id);
			const entry = buildAssistanceBatchEntries(
				[selected],
				date,
				meal,
				mintNutritionUuid,
			)[0];
			if (!entry) throw new Error("Label portion could not be prepared.");
			operations.create(
				subject,
				entry,
				undefined,
				() => {
					labelSubmitRef.current = false;
					setLabelSaving(false);
					toast.error(messages.labelFailure);
				},
				() => {
					labelSubmitRef.current = false;
					setLabelSaving(false);
					setLabelAccepted(true);
				},
			);
		} catch {
			labelSubmitRef.current = false;
			setLabelSaving(false);
			toast.error(messages.labelFailure);
		}
	}

	return (
		<KeyboardAvoidingView
			style={styles.root}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={styles.content}
			>
				<Eyebrow>{messages.title}</Eyebrow>
				<AppText variant="title">{context}</AppText>
				<AppText variant="caption">{messages.intro}</AppText>
				<View style={styles.tabs}>
					<ModeButton
						active={mode === "text"}
						label={messages.textMode}
						onPress={() => setMode("text")}
					/>
					<ModeButton
						active={mode === "label"}
						label={messages.labelMode}
						onPress={() => setMode("label")}
					/>
				</View>

				{mode === "text" ? (
					<>
						<AppText variant="label">{messages.textMode}</AppText>
						<TextInput
							value={text}
							onChangeText={(value) => {
								setText(value);
								setTextError(undefined);
							}}
							placeholder={messages.textPlaceholder}
							placeholderTextColor={colors.textMuted}
							multiline
							accessibilityLabel={messages.textMode}
							style={styles.textArea}
						/>
						<PrimaryButton
							label={messages.parse}
							onPress={parseTextInput}
							disabled={!text.trim()}
						/>
						{textError ? (
							<AppText accessibilityRole="alert" style={styles.warning}>
								{textError}
							</AppText>
						) : null}
						{rows.length === 0 ? (
							<EmptyState body={messages.selectionPrompt} />
						) : (
							rows.map((row) => (
								<AssistanceRowView
									key={row.id}
									row={row}
									locale={locale}
									messages={messages}
									onSelect={(candidateId) => chooseRow(row.id, candidateId)}
									onReparse={(nextText) =>
										setRows((current) =>
											current.map((candidate) =>
												candidate.id === row.id
													? reparseAssistanceRow(
															candidate,
															nextText,
															catalog,
															locale,
														)
													: candidate,
											),
										)
									}
								/>
							))
						)}
						{reviewingBatch ? (
							<Card style={styles.reviewCard}>
								<AppText variant="heading">{messages.reviewBatch}</AppText>
								{rows.map((row) => (
									<AppText key={row.id} variant="caption">
										{row.quantity} {row.unit} ·{" "}
										{
											row.candidates.find(
												(item) => item.id === row.selectedCandidateId,
											)?.name[locale]
										}
									</AppText>
								))}
								<PrimaryButton
									label={messages.logBatch}
									loading={batchSaving}
									disabled={batchAccepted}
									onPress={saveBatch}
								/>
								<GhostButton
									label={messages.editBatch}
									onPress={() => setReviewingBatch(false)}
								/>
							</Card>
						) : (
							<PrimaryButton
								label={messages.reviewBatch}
								onPress={() => setReviewingBatch(true)}
								disabled={
									rows.length === 0 ||
									!rows.every((row) => row.status === "selected")
								}
							/>
						)}
						{batchAccepted ? (
							<AppText style={styles.success}>{messages.batchAccepted}</AppText>
						) : null}
					</>
				) : (
					<LabelReview
						messages={messages}
						locale={locale}
						labelText={labelText}
						setLabelText={setLabelText}
						label={label}
						labelNames={labelNames}
						setLabelNames={setLabelNames}
						labelUnit={labelUnit}
						setLabelUnit={setLabelUnit}
						labelInputs={labelInputs}
						setLabelInputs={setLabelInputs}
						portionText={portionText}
						setPortionText={setPortionText}
						labelSaving={labelSaving}
						labelAccepted={labelAccepted}
						onParse={parseLabelInput}
						onSave={saveLabelFood}
					/>
				)}
				<Card style={styles.gated}>
					<AppText variant="caption">{messages.photoGated}</AppText>
					<AppText variant="caption">{messages.mealPhotoGated}</AppText>
				</Card>
				<GhostButton label={messages.close} onPress={onClose} />
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

function AssistanceRowView({
	row,
	locale,
	messages,
	onSelect,
	onReparse,
}: {
	row: AssistanceRow;
	locale: "en" | "nl";
	messages: ReturnType<typeof getNutritionAssistanceMessages>;
	onSelect: (candidateId: string) => void;
	onReparse: (text: string) => void;
}) {
	const [draft, setDraft] = useState(row.raw);
	return (
		<Card style={styles.rowCard}>
			<TextInput
				value={draft}
				onChangeText={setDraft}
				accessibilityLabel={row.raw}
				style={styles.input}
			/>
			<GhostButton label={messages.reparse} onPress={() => onReparse(draft)} />
			{row.status === "ambiguous" ? (
				<AppText style={styles.warning}>{messages.ambiguous}</AppText>
			) : null}
			{row.error === "unsupported-quantity" ? (
				<AppText style={styles.warning}>{messages.unsupportedQuantity}</AppText>
			) : null}
			{row.error === "no-match" ? (
				<AppText style={styles.warning}>{messages.noMatch}</AppText>
			) : null}
			{row.error === "unit-mismatch" ? (
				<AppText style={styles.warning}>{messages.unitMismatch}</AppText>
			) : null}
			{row.candidates.length > 0 ? (
				<AppText variant="caption">{messages.selectionPrompt}</AppText>
			) : null}
			{row.candidates.map((candidate) => (
				<Pressable
					key={candidate.id}
					onPress={() => onSelect(candidate.id)}
					accessibilityRole="button"
					accessibilityState={{
						selected: row.selectedCandidateId === candidate.id,
					}}
					style={({ pressed }) => [styles.candidate, pressed && styles.pressed]}
				>
					<AppText>
						{candidate.name[locale]} · {candidate.baseUnit}
					</AppText>
				</Pressable>
			))}
		</Card>
	);
}

function LabelReview({
	messages,
	locale,
	labelText,
	setLabelText,
	label,
	labelNames,
	setLabelNames,
	labelUnit,
	setLabelUnit,
	labelInputs,
	setLabelInputs,
	portionText,
	setPortionText,
	labelSaving,
	labelAccepted,
	onParse,
	onSave,
}: {
	messages: ReturnType<typeof getNutritionAssistanceMessages>;
	locale: "en" | "nl";
	labelText: string;
	setLabelText: (value: string) => void;
	label: ReturnType<typeof parseNutritionLabel>;
	labelNames: { en: string; nl: string };
	setLabelNames: (value: { en: string; nl: string }) => void;
	labelUnit: "g" | "ml";
	setLabelUnit: (value: "g" | "ml") => void;
	labelInputs: Record<NutrientKey, string>;
	setLabelInputs: React.Dispatch<
		React.SetStateAction<Record<NutrientKey, string>>
	>;
	portionText: string;
	setPortionText: (value: string) => void;
	labelSaving: boolean;
	labelAccepted: boolean;
	onParse: () => void;
	onSave: () => void;
}) {
	return (
		<>
			<AppText variant="heading">{messages.labelTitle}</AppText>
			<AppText variant="caption">{messages.labelIntro}</AppText>
			<TextInput
				value={labelText}
				onChangeText={setLabelText}
				placeholder={messages.labelPlaceholder}
				placeholderTextColor={colors.textMuted}
				multiline
				accessibilityLabel={messages.labelTitle}
				style={styles.textArea}
			/>
			<PrimaryButton
				label={messages.parseLabel}
				onPress={onParse}
				disabled={!labelText.trim()}
			/>
			{label ? (
				<Card style={styles.reviewCard}>
					<AppText variant="heading">{messages.labelReview}</AppText>
					<Field
						label={messages.nameEnglish}
						value={labelNames.en}
						onChangeText={(value) =>
							setLabelNames({ ...labelNames, en: value })
						}
					/>
					<Field
						label={messages.nameDutch}
						value={labelNames.nl}
						onChangeText={(value) =>
							setLabelNames({ ...labelNames, nl: value })
						}
					/>
					<AppText variant="label">{messages.baseUnit}</AppText>
					<View style={styles.tabs}>
						<ModeButton
							active={labelUnit === "g"}
							label={messages.grams}
							onPress={() => setLabelUnit("g")}
						/>
						<ModeButton
							active={labelUnit === "ml"}
							label={messages.millilitres}
							onPress={() => setLabelUnit("ml")}
						/>
					</View>
					<AppText variant="caption">{messages.allNutrients}</AppText>
					{label.energyBasis === "kj-converted" ? (
						<AppText variant="caption" style={styles.success}>
							{messages.energyConverted}
						</AppText>
					) : null}
					{NUTRIENT_KEYS.map((key) => (
						<Field
							key={key}
							label={NUTRIENT_LABELS[key][locale]}
							value={labelInputs[key]}
							onChangeText={(value) =>
								setLabelInputs((current) => ({ ...current, [key]: value }))
							}
							keyboardType="decimal-pad"
						/>
					))}
					<Field
						label={messages.portion}
						value={portionText}
						onChangeText={setPortionText}
						keyboardType="decimal-pad"
					/>
					<PrimaryButton
						label={messages.saveAndLog}
						loading={labelSaving}
						disabled={labelAccepted}
						onPress={onSave}
					/>
					{labelAccepted ? (
						<AppText style={styles.success}>{messages.labelAccepted}</AppText>
					) : null}
				</Card>
			) : null}
		</>
	);
}

function Field({
	label,
	value,
	onChangeText,
	keyboardType,
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
				value={value}
				onChangeText={onChangeText}
				keyboardType={keyboardType}
				accessibilityLabel={label}
				style={styles.input}
			/>
		</View>
	);
}

function ModeButton({
	active,
	label,
	onPress,
}: {
	active: boolean;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityState={{ selected: active }}
			style={[styles.modeButton, active && styles.modeActive]}
		>
			<AppText style={{ color: active ? colors.onAccent : colors.text }}>
				{label}
			</AppText>
		</Pressable>
	);
}

function mealLabel(meal: MealSlot, locale: "en" | "nl") {
	const labels = {
		breakfast: { en: "Breakfast", nl: "Ontbijt" },
		lunch: { en: "Lunch", nl: "Lunch" },
		dinner: { en: "Dinner", nl: "Diner" },
		snacks: { en: "Snacks", nl: "Tussendoortjes" },
	};
	return labels[meal][locale];
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingBottom: 48, gap: spacing.md },
	tabs: { flexDirection: "row", gap: spacing.sm },
	modeButton: {
		flex: 1,
		minHeight: 48,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.sm,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: radius.lg,
	},
	modeActive: { backgroundColor: colors.accent, borderColor: colors.accent },
	textArea: {
		minHeight: 112,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: radius.md,
		backgroundColor: colors.surface2,
		padding: spacing.md,
		color: colors.text,
		textAlignVertical: "top",
	},
	rowCard: { gap: spacing.sm },
	reviewCard: { gap: spacing.sm },
	input: {
		minHeight: 48,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: radius.md,
		backgroundColor: colors.surface2,
		paddingHorizontal: spacing.md,
		color: colors.text,
	},
	candidate: {
		minHeight: 48,
		justifyContent: "center",
		paddingHorizontal: spacing.md,
		borderRadius: radius.md,
		backgroundColor: colors.surface2,
	},
	pressed: { backgroundColor: colors.accentDim },
	field: { gap: spacing.xs },
	warning: { color: colors.danger },
	success: { color: colors.success },
	gated: { gap: spacing.xs, borderColor: colors.borderStrong },
});
