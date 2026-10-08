import { convertLoad, estimatedMaxReps } from "@workouts/core";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
	Platform,
	Pressable,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { useI18n } from "../../i18n";
import { radius, spacing, useTokens } from "../../theme";
import {
	DisclosureRow,
	FormScreen,
	FormSection,
	FormTextField,
} from "../../ui/form";
import { PlateSheet } from "../../ui/plate-sheet";
import { SelectionMenu } from "../../ui/selection-menu";
import { AppText } from "../../ui/text";
import { QuantityField } from "./components/quantity-field";
import { parseSetFields, useSetEditor } from "./set-editor-flow";

export function SetEditorScreen() {
	const editor = useSetEditor();
	const router = useRouter();
	const {
		locale,
		t: { strength: copy },
	} = useI18n();
	const colors = useTokens();
	const expanded = useWindowDimensions().fontScale > 1.4;
	const [plates, setPlates] = useState(false);
	const { fields, exercise, locked, busy, bodyweight } = editor;
	const parsed = fields ? parseSetFields(fields) : null;
	const format = (value: number) =>
		value.toLocaleString(locale, { maximumFractionDigits: 1 });
	const title = `${copy.set} ${editor.saved?.setNumber ?? editor.nextNumber}`;
	return (
		<>
			<Stack.Screen
				options={{
					title,
					gestureEnabled: !busy,
					...(Platform.OS === "android"
						? {
								headerLeft: () => (
									<Pressable
										accessibilityRole="button"
										disabled={busy}
										onPress={editor.close}
									>
										<AppText>{copy.close}</AppText>
									</Pressable>
								),
							}
						: {}),
				}}
			/>
			{Platform.OS === "ios" && (
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button
						icon="xmark"
						accessibilityLabel={copy.close}
						disabled={busy}
						onPress={editor.close}
					/>
				</Stack.Toolbar>
			)}
			<FormScreen
				nativeSheet
				primaryAction={{
					label: busy
						? copy.saving
						: editor.savedId
							? copy.save
							: editor.draft?.attempt
								? copy.retryLog
								: copy.logSet,
					onPress: () => void editor.submit(),
					disabled:
						!parsed ||
						busy ||
						!editor.writable ||
						Boolean(editor.savedId && !editor.dirty),
					loading: busy,
				}}
			>
				<AppText variant="heading">{exercise?.name ?? copy.exercises}</AppText>
				{editor.storageError && (
					<AppText accessibilityRole="alert">{copy.storageError}</AppText>
				)}
				{!editor.active && !editor.savedId && (
					<AppText accessibilityRole="alert">
						{editor.data.session &&
						!(editor.data.session instanceof Error) &&
						editor.data.session.status !== "active"
							? copy.ended
							: copy.unavailableHint}
					</AppText>
				)}
				{!editor.data.online && (
					<AppText variant="footnote">{copy.offline}</AppText>
				)}
				{(editor.data.error || editor.historyError) && (
					<AppText accessibilityRole="alert">{copy.unavailableHint}</AppText>
				)}
				{editor.draft?.attempt && (
					<AppText variant="footnote">{copy.receiptPending}</AppText>
				)}
				{fields && !parsed && (
					<AppText accessibilityRole="alert">{copy.invalidSet}</AppText>
				)}
				{fields ? (
					<>
						<View
							style={[styles.quantities, expanded && styles.expandedQuantities]}
						>
							<QuantityField
								label={bodyweight ? copy.addedWeight : copy.weight}
								unit={fields.unit}
								value={fields.weight}
								step={editor.step}
								max={2000}
								disabled={locked}
								onChange={(weight) => editor.change({ weight })}
							/>
							<QuantityField
								label={copy.reps}
								integer
								value={fields.reps}
								step={1}
								max={1000}
								disabled={locked}
								onChange={(reps) => editor.change({ reps })}
							/>
						</View>
						{!bodyweight && (
							<SelectionMenu
								label={fields.unit}
								accessibilityLabel={copy.unit}
								disabled={locked}
								groups={[
									{
										options: ["kg", "lbs"].map((unit) => ({
											id: unit,
											label: unit,
											selected: fields.unit === unit,
										})),
									},
								]}
								onSelect={(unit) => {
									if (unit !== "kg" && unit !== "lbs") return;
									const weight = Number(fields.weight.replace(",", "."));
									if (Number.isFinite(weight))
										editor.change({
											unit,
											weight: String(
												Math.round(
													convertLoad(weight, fields.unit, unit) * 1000,
												) / 1000,
											),
										});
								}}
							/>
						)}
						<View style={styles.comparison}>
							<DisclosureRow
								label={copy.strengthProfile}
								onPress={() => router.push("/set-editor/strength-profile")}
								disabled={locked}
							/>
							<View style={styles.compareRow}>
								<AppText variant="footnote" style={styles.reference}>
									{copy.reference}
								</AppText>
								<AppText variant="footnote" style={styles.metric}>
									% 1RM
								</AppText>
								<AppText variant="footnote" style={styles.prediction}>
									{copy.predictedReps}
								</AppText>
							</View>
							{(["measured", "estimated"] as const).map((kind) => {
								const reference = bodyweight
									? null
									: editor.member?.references?.[kind];
								const value = reference
									? convertLoad(reference.value, reference.unit, fields.unit)
									: null;
								const reps =
									value && parsed
										? estimatedMaxReps(value, parsed.weight)
										: null;
								return (
									<View
										key={kind}
										style={[
											styles.compareRow,
											{
												borderTopWidth: StyleSheet.hairlineWidth,
												borderColor: colors.separator,
											},
										]}
									>
										<View style={styles.reference}>
											<AppText variant="label">{copy[kind]}</AppText>
											<AppText variant="footnote">
												{value ? `${format(value)} ${fields.unit}` : "—"}
											</AppText>
										</View>
										<AppText style={styles.metric}>
											{value && parsed
												? `${format((parsed.weight / value) * 100)}%`
												: "—"}
										</AppText>
										<AppText style={styles.prediction}>
											{reps === null
												? "—"
												: reps === 0
													? copy.aboveReference
													: `≈${reps}`}
										</AppText>
									</View>
								);
							})}
							<AppText variant="footnote">
								{bodyweight ? copy.bodyweightHint : copy.approximation}
							</AppText>
						</View>
						<View style={styles.choices}>
							{(["warmup", "working", "drop", "failure"] as const).map(
								(setType) => (
									<Pressable
										key={setType}
										accessibilityRole="radio"
										accessibilityState={{
											checked: fields.setType === setType,
											disabled: locked,
										}}
										disabled={locked}
										onPress={() => editor.change({ setType })}
										style={[
											styles.choice,
											{
												borderColor:
													fields.setType === setType
														? colors.accent
														: colors.border,
												backgroundColor:
													fields.setType === setType
														? colors.accentDim
														: colors.surface,
											},
										]}
									>
										<AppText variant="label">{copy[setType]}</AppText>
									</Pressable>
								),
							)}
						</View>
						<FormSection title={`${copy.rpe} · ${copy.optional}`}>
							<AppText variant="footnote" style={styles.rpeHint}>
								{copy.remaining}
							</AppText>
							<View style={styles.choices}>
								{[5, 6, 7, 8, 9, 10].map((rpe) => (
									<Pressable
										key={rpe}
										accessibilityRole="radio"
										accessibilityLabel={`RPE ${rpe}: ${10 - rpe} ${copy.remaining}`}
										accessibilityState={{
											checked: fields.rpe === String(rpe),
											disabled: locked,
										}}
										disabled={locked}
										onPress={() =>
											editor.change({
												rpe: fields.rpe === String(rpe) ? "" : String(rpe),
											})
										}
										style={[
											styles.rpe,
											{
												backgroundColor:
													fields.rpe === String(rpe)
														? colors.accentDim
														: colors.surface,
											},
										]}
									>
										<AppText variant="heading">{rpe}</AppText>
										<AppText variant="caption">
											{rpe === 5 ? "5+" : 10 - rpe}
										</AppText>
									</Pressable>
								))}
							</View>
							<FormTextField
								label={copy.rpe}
								value={fields.rpe}
								onChangeText={(rpe) => editor.change({ rpe })}
								editable={!locked}
								keyboardType="decimal-pad"
								placeholder={copy.noRpe}
							/>
						</FormSection>
						<FormSection title={copy.last}>
							<View style={styles.previous}>
								<AppText>
									{editor.last
										? `${format(editor.last.weight)} ${editor.last.unit} × ${editor.last.reps}${editor.last.rpe === undefined ? "" : ` · RPE ${editor.last.rpe}`}`
										: copy.noPrevious}
								</AppText>
								{editor.last && (
									<AppText variant="footnote">
										{new Date(editor.last.loggedAt).toLocaleDateString(locale)}
									</AppText>
								)}
							</View>
						</FormSection>
						{exercise?.equipment === "barbell" && (
							<FormSection>
								<DisclosureRow
									label={copy.plates}
									disabled={locked}
									onPress={() => setPlates(true)}
								/>
							</FormSection>
						)}
						{editor.savedId ? (
							<FormSection>
								<DisclosureRow
									label={copy.repeat}
									disabled={!editor.active || busy}
									onPress={() => void editor.repeat()}
								/>
								<DisclosureRow
									label={copy.delete}
									disabled={!editor.writable || busy}
									destructive
									onPress={() => void editor.deleteSet()}
								/>
							</FormSection>
						) : (
							<>
								<AppText variant="footnote">{copy.localDraft}</AppText>
								<FormSection>
									<DisclosureRow
										label={copy.discardDraft}
										disabled={locked}
										destructive
										onPress={() => void editor.discard()}
									/>
								</FormSection>
							</>
						)}
					</>
				) : (
					<AppText>{copy.checking}</AppText>
				)}
			</FormScreen>
			{plates && (
				<PlateSheet
					visible
					weight={parsed ? convertLoad(parsed.weight, parsed.unit, "kg") : 0}
					onClose={() => setPlates(false)}
				/>
			)}
		</>
	);
}
const styles = StyleSheet.create({
	expandedQuantities: { flexDirection: "column", flexWrap: "nowrap" },
	rpeHint: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
	quantities: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
	comparison: { gap: spacing.sm },
	compareRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingVertical: spacing.sm,
	},
	reference: { flex: 1.4 },
	metric: { flex: 0.7, textAlign: "right", fontVariant: ["tabular-nums"] },
	prediction: { flex: 1, textAlign: "right", fontVariant: ["tabular-nums"] },
	choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
	choice: {
		flexGrow: 1,
		minHeight: 48,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: spacing.sm,
		borderWidth: 1,
		borderRadius: radius.sm,
	},
	rpe: {
		flexGrow: 1,
		minWidth: 44,
		minHeight: 64,
		alignItems: "center",
		justifyContent: "center",
		padding: spacing.xs,
	},
	previous: { padding: spacing.md, gap: spacing.xs },
});
