/**
 * The Krachtprofiel body: references, percentages and rep maxes for one
 * exercise. A session passes its set and `onApply`; the exercise page shows it
 * read-only, with nothing to apply.
 */
import { SET_LIMITS, weightForRepMax } from "@foundry/core";
import { useState } from "react";
import {
	Keyboard,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	dateLocale,
	fmt,
	parseLocalizedDecimal,
	plural,
	useI18n,
} from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Segmented } from "../../../ui/segmented";
import { AppText } from "../../../ui/text";
import { formatNumber, formatSetFull, LOADED_FORMAT } from "../session-format";
import {
	applyPercent,
	type ExerciseFacts,
	type PlanSet,
	rowOneRepMax,
	type StrengthReference,
	shownLoad,
	snapLoad,
	withTypedLoad,
} from "../session-plan";

const PERCENT_ROWS = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
const REP_ROWS = [1, 2, 3, 4, 5, 6, 8, 10];
type Pick =
	| { kind: "percent"; value: number }
	| { kind: "reps"; value: number };

function ReferenceRow({
	label,
	sub,
	value,
}: {
	label: string;
	sub?: string;
	value: string;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View accessible style={styles.referenceRow}>
			<View style={styles.flex}>
				<AppText variant="row">{label}</AppText>
				{sub ? (
					<AppText variant="caption" style={{ color: colors.textMuted }}>
						{sub}
					</AppText>
				) : null}
			</View>
			<AppText variant="row" style={{ fontWeight: "700" }}>
				{value}
			</AppText>
		</View>
	);
}

export function StrengthProfileView({
	facts,
	reference,
	manual,
	today,
	row,
	onApply,
	onEnterOneRm,
}: {
	facts: ExerciseFacts;
	reference: StrengthReference | null;
	/** The manual 1RM to show; `date` is unknown for a session-only override. */
	manual: { value: number; date: number | null } | null;
	/** What this session logged so far; absent outside a session. */
	today?: { measured: number | null; estimated: number | null };
	/** The set a picked row would change. */
	row?: PlanSet;
	/** Present in a session: picking a row stages it and Apply copies it. */
	onApply?: (chosen: PlanSet) => void;
	onEnterOneRm?: () => void;
}) {
	const { locale, t } = useI18n();
	const copy = t.strength.plan.profile;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const [mode, setMode] = useState<"percent" | "reps">("percent");
	const [pick, setPick] = useState<Pick | null>(null);
	const [customText, setCustomText] = useState("");
	const readOnly = !onApply;
	const number = (value: number) =>
		formatNumber(Math.round(value * 10) / 10, locale);
	const date = (value: number | null | undefined) =>
		value
			? new Date(value).toLocaleDateString(dateLocale(locale), {
					day: "numeric",
					month: "short",
				})
			: undefined;
	const stepKg = facts.stepKg;
	const unit = row?.unit ?? "kg";
	const priced = (kg: number) => snapLoad(kg, stepKg, unit);
	const display = (kg: number) =>
		`${formatNumber(shownLoad({ kg, unit }), locale, unit === "lbs" ? 1 : 2)} ${unit}`;
	function resultFor(choice: Pick): PlanSet | null {
		if (!row || !reference) return null;
		if (choice.kind === "percent")
			return applyPercent(row, choice.value, reference, facts);
		const kg = priced(weightForRepMax(reference.value, choice.value));
		return {
			...withTypedLoad(row, unit === "lbs" ? shownLoad({ kg, unit }) : kg),
			reps: choice.value,
			percent: null,
			blank: undefined,
		};
	}
	const chosen = pick ? resultFor(pick) : null;
	const customValue = parseLocalizedDecimal(customText) ?? Number.NaN;
	const estimate = row ? rowOneRepMax(row, facts) : null;
	const selectable = Boolean(row && !readOnly);
	return (
		<View style={styles.screen}>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={styles.content}
			>
				{facts.bodyweight ? (
					<AppText variant="secondary" style={{ color: colors.textMuted }}>
						{copy.bodyweight}
					</AppText>
				) : (
					<>
						<View style={styles.card}>
							<ReferenceRow
								label={copy.measured}
								sub={date(facts.measuredDate)}
								value={
									facts.measured === null
										? copy.empty
										: `${number(facts.measured)} kg`
								}
							/>
							{manual ? (
								<ReferenceRow
									label={copy.manual}
									sub={date(manual.date)}
									value={`${number(manual.value)} kg`}
								/>
							) : null}
							<ReferenceRow
								label={copy.estimated}
								value={
									facts.estimated === null
										? copy.empty
										: `≈${Math.round(facts.estimated)} kg`
								}
							/>
							{today && today.measured !== null ? (
								<ReferenceRow
									label={copy.todayMeasured}
									sub={copy.appliesNext}
									value={`${number(today.measured)} kg`}
								/>
							) : null}
							{today && today.estimated !== null ? (
								<ReferenceRow
									label={copy.todayEstimated}
									value={`≈${Math.round(today.estimated)} kg`}
								/>
							) : null}
						</View>
						{row && estimate && row.reps > 1 ? (
							<AppText variant="secondary" style={{ color: colors.textMuted }}>
								{fmt(copy.fromSet, {
									load: formatSetFull(row, LOADED_FORMAT, locale),
									value: Math.round(estimate.value),
								})}
							</AppText>
						) : null}
						{reference ? (
							<>
								<Segmented
									options={[
										{ value: "percent", label: copy.percentages },
										{ value: "reps", label: copy.repMax },
									]}
									value={mode}
									onChange={(next) => {
										setMode(next);
										setPick(null);
									}}
								/>
								<AppText variant="caption" style={{ color: colors.textMuted }}>
									{fmt(
										reference.source === "manual"
											? readOnly
												? copy.fromManualView
												: copy.fromManual
											: readOnly
												? copy.fromMeasuredView
												: copy.fromMeasured,
										{ value: number(reference.value) },
									)}
								</AppText>
								<View style={styles.card}>
									{(mode === "percent" ? PERCENT_ROWS : REP_ROWS).map(
										(value) => {
											const kg =
												mode === "percent"
													? priced((reference.value * value) / 100)
													: priced(weightForRepMax(reference.value, value));
											const label =
												mode === "percent"
													? `${value}%`
													: plural(locale, value, copy.repsRow);
											const on = pick?.kind === mode && pick.value === value;
											const cells = (
												<>
													<AppText variant="row">{label}</AppText>
													<AppText variant="row" style={{ fontWeight: "700" }}>
														{display(kg)}
													</AppText>
												</>
											);
											// Read-only rows are a table to read, not choices.
											return readOnly ? (
												<View key={value} accessible style={styles.tableRow}>
													{cells}
												</View>
											) : (
												<Pressable
													key={value}
													accessibilityRole="button"
													accessibilityState={{
														selected: on,
														disabled: !selectable,
													}}
													disabled={!selectable}
													onPress={() => setPick({ kind: mode, value })}
													style={[styles.tableRow, on && styles.tableRowOn]}
												>
													{cells}
												</Pressable>
											);
										},
									)}
									{mode === "percent" && (row || readOnly) ? (
										<View style={styles.tableRow}>
											<TextInput
												accessibilityLabel={copy.customPercent}
												value={customText}
												onChangeText={(value) => {
													setCustomText(value);
													const parsed =
														parseLocalizedDecimal(value) ?? Number.NaN;
													setPick(
														parsed > 0 &&
															parsed <= SET_LIMITS.percentOfOneRepMax.max
															? { kind: "percent", value: parsed }
															: null,
													);
												}}
												onBlur={Keyboard.dismiss}
												keyboardType="decimal-pad"
												placeholder={copy.customPercent}
												placeholderTextColor={colors.textMuted}
												style={styles.customInput}
											/>
											{customValue > 0 &&
											customValue <= SET_LIMITS.percentOfOneRepMax.max ? (
												<AppText variant="row" style={{ fontWeight: "700" }}>
													{display(
														priced((reference.value * customValue) / 100),
													)}
												</AppText>
											) : null}
										</View>
									) : null}
								</View>
							</>
						) : (
							<AppText variant="secondary" style={{ color: colors.textMuted }}>
								{copy.none}
							</AppText>
						)}
					</>
				)}
			</ScrollView>
			{facts.bodyweight || (reference ? !onApply : !onEnterOneRm) ? null : (
				<View
					style={[
						styles.footer,
						{ paddingBottom: Math.max(insets.bottom, spacing.sm) },
					]}
				>
					{reference ? (
						<Pressable
							accessibilityRole="button"
							accessibilityState={{ disabled: !chosen }}
							disabled={!chosen}
							onPress={() => chosen && onApply?.(chosen)}
							style={[styles.primary, !chosen && styles.primaryOff]}
						>
							<AppText
								variant="control"
								style={{
									color: chosen ? colors.onAccent : colors.textMuted,
									fontWeight: "700",
								}}
							>
								{chosen
									? fmt(copy.apply, {
											load: formatSetFull(chosen, LOADED_FORMAT, locale),
										})
									: copy.pick}
							</AppText>
						</Pressable>
					) : (
						<Pressable
							accessibilityRole="button"
							onPress={onEnterOneRm}
							style={styles.primary}
						>
							<AppText
								variant="control"
								style={{ color: colors.onAccent, fontWeight: "700" }}
							>
								{copy.enterOneRm}
							</AppText>
						</Pressable>
					)}
				</View>
			)}
		</View>
	);
}
const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		screen: { flex: 1, backgroundColor: colors.bg },
		flex: { flex: 1, minWidth: 0 },
		content: { padding: spacing.md, gap: spacing.md },
		card: {
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
			overflow: "hidden",
		},
		referenceRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			minHeight: 52,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.xs,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: colors.separator,
		},
		tableRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			minHeight: 48,
			paddingHorizontal: spacing.md,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: colors.separator,
		},
		tableRowOn: { backgroundColor: colors.accentDim },
		customInput: { flex: 1, minHeight: 44, color: colors.text },
		footer: {
			paddingHorizontal: spacing.md,
			paddingTop: spacing.sm,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		primary: {
			minHeight: 56,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.pill,
			backgroundColor: colors.accentFill,
		},
		primaryOff: { backgroundColor: colors.surface2 },
	});
