import {
	calculateOneRepMax,
	convertLoad,
	roundLoad,
	weightForRepMax,
} from "@workouts/core";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useI18n } from "../../i18n";
import { radius, spacing, useTokens } from "../../theme";
import {
	FormScreen,
	FormSection,
	FormTextField,
	GroupedSurface,
} from "../../ui/form";
import { AppText } from "../../ui/text";
import { parseSetFields, useSetEditor } from "./set-editor-flow";

type Source = "measured" | "estimated" | "manual";
export function StrengthProfileScreen() {
	const editor = useSetEditor();
	const router = useRouter();
	const colors = useTokens();
	const {
		locale,
		t: { strength: copy },
	} = useI18n();
	const [percent, setPercent] = useState("80");
	const [candidate, setCandidate] = useState<{
		weight: number;
		reps: number;
		source: Source;
	} | null>(null);
	const fields = editor.fields;
	const parsed = fields ? parseSetFields(fields) : null;
	const unit = fields?.unit ?? "kg";
	const format = (value: number) =>
		value.toLocaleString(locale, { maximumFractionDigits: 1 });
	const references = editor.bodyweight ? undefined : editor.member?.references;
	const sources = (["measured", "estimated", "manual"] as const).filter(
		(source) => source !== "manual" || references?.manual,
	);
	const pct = Number(percent.replace(",", "."));
	const validPercent = Number.isFinite(pct) && pct > 0 && pct <= 200;
	function referenceValue(source: Source) {
		const reference = references?.[source];
		return reference
			? convertLoad(reference.value, reference.unit, unit)
			: null;
	}
	function choose(source: Source, load: number, reps: number) {
		setCandidate({ source, weight: roundLoad(load, editor.step), reps });
	}
	return (
		<>
			<Stack.Screen options={{ title: copy.strengthProfile }} />
			<FormScreen
				nativeSheet
				primaryAction={{
					label: copy.apply,
					disabled: !candidate || editor.locked,
					onPress: () => {
						if (!candidate) return;
						editor.change({
							weight: String(candidate.weight),
							reps: String(candidate.reps),
						});
						router.back();
					},
				}}
			>
				<AppText variant="heading">{editor.exercise?.name}</AppText>
				{!editor.data.verified && (
					<AppText accessibilityRole="alert">
						{editor.data.error || !editor.data.online
							? copy.referencesUnavailable
							: copy.referencesLoading}
					</AppText>
				)}
				<AppText variant="footnote">{copy.frozen}</AppText>
				<View style={styles.sources}>
					{sources.map((source) => {
						const reference = references?.[source];
						const value = referenceValue(source);
						return (
							<GroupedSurface key={source} style={styles.source}>
								<AppText variant="label">{copy[source]}</AppText>
								<AppText variant="metric">
									{value ? `${format(value)} ${unit}` : "—"}
								</AppText>
								<AppText variant="footnote">
									{reference
										? `${source === "measured" ? copy.loggedSingle : source === "estimated" ? copy.epley : copy.manualSource} · ${new Date(reference.date).toLocaleDateString(locale)}`
										: copy.noReference}
								</AppText>
								{reference?.performance && (
									<AppText variant="footnote">{`${format(reference.performance.weight)} ${reference.performance.unit} × ${reference.performance.reps}`}</AppText>
								)}
							</GroupedSurface>
						);
					})}
				</View>
				{editor.bodyweight ? (
					<AppText>{copy.bodyweightHint}</AppText>
				) : (
					<>
						<AppText variant="heading">{copy.percent}</AppText>
						<View style={styles.percentages}>
							{[60, 70, 75, 80, 85, 90].map((value) => (
								<Pressable
									key={value}
									accessibilityRole="radio"
									accessibilityLabel={`${value}%`}
									accessibilityState={{ checked: pct === value }}
									onPress={() => {
										setPercent(String(value));
										setCandidate(null);
									}}
									style={[
										styles.percent,
										{
											backgroundColor:
												pct === value ? colors.accentDim : colors.surface,
										},
									]}
								>
									<AppText variant="label">{value}%</AppText>
								</Pressable>
							))}
						</View>
						<FormSection>
							<FormTextField
								label={copy.customPercent}
								value={percent}
								onChangeText={(value) => {
									setPercent(value);
									setCandidate(null);
								}}
								keyboardType="decimal-pad"
							/>
						</FormSection>
						<View style={styles.sources}>
							{sources.map((source) => {
								const value = referenceValue(source);
								const load =
									value && validPercent
										? roundLoad((value * pct) / 100, editor.step)
										: null;
								return (
									<Pressable
										key={source}
										accessibilityRole="radio"
										accessibilityLabel={`${copy[source]}: ${load === null ? "—" : `${format(load)} ${unit}`}`}
										accessibilityState={{
											checked:
												candidate?.source === source &&
												candidate.weight === load,
											disabled: load === null,
										}}
										disabled={load === null}
										onPress={() => {
											if (load !== null)
												choose(source, load, parsed?.reps ?? 8);
										}}
										style={[
											styles.option,
											{
												backgroundColor: colors.surface,
												borderColor:
													candidate?.source === source &&
													candidate.weight === load
														? colors.accent
														: colors.border,
											},
										]}
									>
										<AppText variant="label">{copy[source]}</AppText>
										<AppText variant="title">
											{load === null ? "—" : `${format(load)} ${unit}`}
										</AppText>
										<AppText variant="footnote">
											{load !== null && value
												? `${format((load / value) * 100)}%`
												: "—"}
										</AppText>
									</Pressable>
								);
							})}
						</View>
						<AppText variant="heading">{copy.repMax}</AppText>
						<GroupedSurface>
							<View style={styles.tableRow}>
								<AppText variant="footnote" style={styles.reps}>
									{copy.reps}
								</AppText>
								{sources.map((source) => (
									<AppText key={source} variant="footnote" style={styles.cell}>
										{copy[source]}
									</AppText>
								))}
							</View>
							{[1, 3, 5, 6, 8, 10, 12].map((reps) => (
								<View
									key={reps}
									style={[
										styles.tableRow,
										{
											borderTopWidth: StyleSheet.hairlineWidth,
											borderColor: colors.separator,
										},
									]}
								>
									<AppText style={styles.reps}>{reps}</AppText>
									{sources.map((source) => {
										const value = referenceValue(source);
										const weight = value
											? roundLoad(weightForRepMax(value, reps), editor.step)
											: null;
										return (
											<Pressable
												key={source}
												accessibilityRole="button"
												accessibilityLabel={`${copy[source]}, ${reps} ${copy.reps}, ${weight === null ? "—" : `${format(weight)} ${unit}`}`}
												disabled={weight === null}
												onPress={() => {
													if (weight !== null) choose(source, weight, reps);
												}}
												style={styles.cell}
											>
												<AppText
													style={{ color: colors.accent, textAlign: "right" }}
												>
													{weight === null ? "—" : format(weight)}
												</AppText>
											</Pressable>
										);
									})}
								</View>
							))}
						</GroupedSurface>
						<AppText variant="footnote">{copy.approximation}</AppText>
					</>
				)}
				<GroupedSurface>
					<AppText variant="label">{copy.currentDraft}</AppText>
					<AppText variant="metric">
						{!editor.bodyweight &&
						parsed &&
						parsed.weight > 0 &&
						parsed.reps > 0
							? `${format(calculateOneRepMax(parsed.weight, parsed.reps).value)} ${unit}`
							: "—"}
					</AppText>
				</GroupedSurface>
				{candidate && (
					<AppText>{`${copy[candidate.source]} · ${format(candidate.weight)} ${unit} × ${candidate.reps}`}</AppText>
				)}
				<AppText variant="footnote">{copy.applyHint}</AppText>
			</FormScreen>
		</>
	);
}
const styles = StyleSheet.create({
	sources: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
	source: { flex: 1, minWidth: 150, gap: spacing.xs },
	percentages: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
	percent: {
		flexGrow: 1,
		minWidth: 44,
		minHeight: 48,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.sm,
	},
	option: {
		flex: 1,
		minWidth: 150,
		gap: spacing.xs,
		padding: spacing.md,
		borderWidth: 1,
		borderRadius: radius.contentCard,
	},
	tableRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	reps: { width: 45 },
	cell: {
		flex: 1,
		minHeight: 48,
		textAlign: "right",
		justifyContent: "center",
	},
});
