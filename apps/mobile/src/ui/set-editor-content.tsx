import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { Chip } from "./coach";
import {
	SET_TYPES,
	type SetEditSheetPresentationProps,
} from "./set-edit-sheet-presentation.types";
import { AppText } from "./text";

export function SetEditorContent({
	setNumber,
	exerciseName,
	weight,
	reps,
	setType,
	weightStep,
	busy,
	dirty,
	onWeightChange,
	onRepsChange,
	onSetTypeChange,
	onRequestClose,
	onSave,
	onDuplicate,
	onDelete,
	bottomInset,
	backgroundColor,
}: SetEditSheetPresentationProps & {
	bottomInset: number;
	backgroundColor: string;
}) {
	return (
		<ScrollView
			style={{ flex: 1, backgroundColor }}
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			contentContainerStyle={[
				styles.sheet,
				{ paddingBottom: bottomInset + spacing.lg },
			]}
		>
			<View style={styles.header}>
				<View style={styles.flex}>
					<AppText variant="heading">Set {setNumber}</AppText>
					<AppText variant="caption">{exerciseName}</AppText>
				</View>
				<Pressable
					onPress={onRequestClose}
					hitSlop={12}
					accessibilityRole="button"
					accessibilityLabel="Close"
				>
					<AppText variant="body" style={styles.close}>
						Close
					</AppText>
				</Pressable>
			</View>
			<View style={styles.typeRow}>
				{SET_TYPES.map((type) => (
					<Pressable
						key={type}
						onPress={() => onSetTypeChange(type)}
						style={styles.flex}
					>
						<Chip label={type} active={type === setType} />
					</Pressable>
				))}
			</View>
			<View style={styles.steppers}>
				<NumberStepper
					label="kg"
					value={weight}
					step={weightStep}
					onChange={onWeightChange}
				/>
				<NumberStepper
					label="reps"
					value={reps}
					step={1}
					min={1}
					onChange={onRepsChange}
				/>
			</View>
			<Pressable
				onPress={onSave}
				disabled={!dirty || busy}
				style={[styles.save, (!dirty || busy) && styles.dimmed]}
			>
				<AppText style={styles.saveText}>
					{busy ? "Saving…" : dirty ? "Save changes" : "No changes"}
				</AppText>
			</Pressable>
			<View style={styles.secondaryRow}>
				<Pressable
					onPress={onDuplicate}
					disabled={busy}
					style={[styles.ghost, busy && styles.dimmed]}
				>
					<AppText style={styles.ghostText}>Duplicate</AppText>
				</Pressable>
				<Pressable
					onPress={onDelete}
					disabled={busy}
					style={[styles.ghost, busy && styles.dimmed]}
				>
					<AppText style={styles.deleteText}>Delete</AppText>
				</Pressable>
			</View>
		</ScrollView>
	);
}

function NumberStepper({
	label,
	value,
	step,
	min = 0,
	onChange,
}: {
	label: string;
	value: number;
	step: number;
	min?: number;
	onChange: (value: number) => void;
}) {
	const round = (number: number) => Math.round(number * 10) / 10;
	return (
		<View style={styles.stepper}>
			<Pressable
				onPress={() => onChange(round(Math.max(min, value - step)))}
				style={styles.stepperBtn}
				hitSlop={8}
				accessibilityRole="button"
				accessibilityLabel={`Decrease ${label}`}
			>
				<AppText style={styles.stepperGlyph}>–</AppText>
			</Pressable>
			<View style={styles.stepperValueWrap}>
				<AppText style={styles.stepperValue}>{value}</AppText>
				<AppText style={styles.stepperLabel}>{label}</AppText>
			</View>
			<Pressable
				onPress={() => onChange(round(value + step))}
				style={styles.stepperBtn}
				hitSlop={8}
				accessibilityRole="button"
				accessibilityLabel={`Increase ${label}`}
			>
				<AppText style={styles.stepperGlyph}>+</AppText>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	sheet: {
		gap: spacing.sm,
		backgroundColor: colors.surface,
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
	},
	header: { flexDirection: "row", alignItems: "center", minHeight: 44 },
	flex: { flex: 1 },
	close: { color: colors.accent, fontWeight: "800" },
	typeRow: { flexDirection: "row", gap: spacing.xs + 2 },
	steppers: { flexDirection: "row", gap: spacing.sm },
	stepper: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		height: 56,
		paddingHorizontal: 6,
		borderRadius: radius.lg,
		backgroundColor: colors.surface2,
	},
	stepperBtn: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	stepperGlyph: { fontSize: 20, fontWeight: "800", color: colors.textMuted },
	stepperValueWrap: { alignItems: "center" },
	stepperValue: { fontSize: 20, fontWeight: "800", color: colors.text },
	stepperLabel: { fontSize: 9, color: colors.textMuted },
	save: {
		height: 48,
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	saveText: { fontSize: 14, fontWeight: "800", color: colors.onAccent },
	secondaryRow: { flexDirection: "row", gap: spacing.sm },
	ghost: {
		flex: 1,
		minHeight: 44,
		borderRadius: radius.pill,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		alignItems: "center",
		justifyContent: "center",
	},
	ghostText: { fontSize: 13, fontWeight: "700", color: colors.text },
	deleteText: { fontSize: 13, fontWeight: "700", color: colors.danger },
	dimmed: { opacity: 0.5 },
});
