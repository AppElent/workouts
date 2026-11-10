/** Your references for one exercise, and every load they imply. */
import { weightForRepMax } from "@foundry/core";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
	Keyboard,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Id } from "../../convex/api";
import { dateLocale, fmt, plural, useI18n } from "../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../theme";
import { Segmented } from "../../ui/segmented";
import { AppText } from "../../ui/text";
import { useSessionActions } from "./data/session-actions";
import { useSessionWorkspace, workspaceStore } from "./data/session-workspace";
import { formatNumber, formatSetFull } from "./session-format";
import {
	applyPercent,
	bestToday,
	findRow,
	type PlanSet,
	referenceFor,
	rowOneRepMax,
	shownLoad,
	snapLoad,
	updateRow,
	withTypedLoad,
} from "./session-plan";

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
export function StrengthProfileScreen() {
	const params = useLocalSearchParams<{
		sessionId: Id<"workoutSessions">;
		exerciseId: string;
		rowId?: string;
	}>();
	const workspace = useSessionWorkspace(params.sessionId);
	const actions = useSessionActions(workspace);
	const { key, plan, drafts, getFacts, nameOf } = workspace;
	const router = useRouter();
	const { locale, t } = useI18n();
	const copy = t.strength.plan.profile;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const [mode, setMode] = useState<"percent" | "reps">("percent");
	const [pick, setPick] = useState<Pick | null>(null);
	const [customText, setCustomText] = useState("");
	const exerciseId = params.exerciseId;
	const facts = getFacts(exerciseId);
	const screenTitle = `${copy.title} · ${nameOf(exerciseId)}`;
	const screenOptions = useMemo(
		() => ({ title: screenTitle, headerTitleStyle: { color: colors.text } }),
		[screenTitle, colors.text],
	);
	if (!plan) return <Stack.Screen options={{ title: copy.title }} />;
	const stored = params.rowId ? findRow(plan, params.rowId) : undefined;
	const row = (params.rowId && drafts[params.rowId]) || stored;
	const reference = referenceFor(plan, facts, exerciseId);
	const today = bestToday(plan, exerciseId, facts);
	const number = (value: number) =>
		formatNumber(Math.round(value * 10) / 10, locale);
	const date = (value: number | null | undefined) =>
		value
			? new Date(value).toLocaleDateString(dateLocale(locale), {
					day: "numeric",
					month: "short",
				})
			: undefined;
	const local = plan.manual[exerciseId];
	const manualValue =
		typeof local === "number"
			? local
			: local === undefined
				? (facts.savedManual?.value ?? null)
				: null;
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
	const close = () => {
		if (router.canGoBack()) router.back();
		else router.dismiss();
	};
	function apply() {
		if (!row || !chosen) return;
		// A send with an unknown result froze this set: its values must match it.
		if (row.attempt) {
			actions.say(t.strength.plan.editor.lockedUnknown);
			close();
			return;
		}
		if (row.done) workspaceStore.setDraft(key, row.id, chosen);
		else actions.set(updateRow(actions.plan(), row.id, chosen));
		close();
	}
	const customValue = Number(customText.replace(",", "."));
	const estimate = row ? rowOneRepMax(row, facts.bodyweight) : null;
	return (
		<>
			<Stack.Screen options={screenOptions} />
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
								{manualValue !== null ? (
									<ReferenceRow
										label={copy.manual}
										sub={date(
											typeof local === "number"
												? null
												: facts.savedManual?.date,
										)}
										value={`${number(manualValue)} kg`}
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
								{today.measured !== null ? (
									<ReferenceRow
										label={copy.todayMeasured}
										sub={copy.appliesNext}
										value={`${number(today.measured)} kg`}
									/>
								) : null}
								{today.estimated !== null ? (
									<ReferenceRow
										label={copy.todayEstimated}
										value={`≈${Math.round(today.estimated)} kg`}
									/>
								) : null}
							</View>
							{row && estimate && row.reps > 1 ? (
								<AppText
									variant="secondary"
									style={{ color: colors.textMuted }}
								>
									{fmt(copy.fromSet, {
										load: formatSetFull(row, false, locale),
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
									<AppText
										variant="caption"
										style={{ color: colors.textMuted }}
									>
										{fmt(
											reference.source === "manual"
												? copy.fromManual
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
												const on = pick?.kind === mode && pick.value === value;
												return (
													<Pressable
														key={value}
														accessibilityRole="button"
														accessibilityState={{
															selected: on,
															disabled: !row,
														}}
														disabled={!row}
														onPress={() => setPick({ kind: mode, value })}
														style={[styles.tableRow, on && styles.tableRowOn]}
													>
														<AppText variant="row">
															{mode === "percent"
																? `${value}%`
																: plural(locale, value, copy.repsRow)}
														</AppText>
														<AppText
															variant="row"
															style={{ fontWeight: "700" }}
														>
															{display(kg)}
														</AppText>
													</Pressable>
												);
											},
										)}
										{mode === "percent" && row ? (
											<View style={styles.tableRow}>
												<TextInput
													accessibilityLabel={copy.customPercent}
													value={customText}
													onChangeText={(value) => {
														setCustomText(value);
														const parsed = Number(value.replace(",", "."));
														setPick(
															parsed > 0 && parsed <= 120
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
												{customValue > 0 && customValue <= 120 ? (
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
								<AppText
									variant="secondary"
									style={{ color: colors.textMuted }}
								>
									{copy.none}
								</AppText>
							)}
						</>
					)}
				</ScrollView>
				{facts.bodyweight ? null : (
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
								onPress={apply}
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
												load: formatSetFull(chosen, false, locale),
											})
										: copy.pick}
								</AppText>
							</Pressable>
						) : (
							<Pressable
								accessibilityRole="button"
								onPress={() => {
									if (actions.blocked()) return;
									router.push({
										pathname: "/session-manual",
										params: { sessionId: params.sessionId, exerciseId },
									});
								}}
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
		</>
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
