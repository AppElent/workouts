/**
 * Edit, duplicate or delete a logged set. Ported from the web's
 * `src/components/session/SetEditSheet.tsx`.
 *
 * Drag-to-dismiss is built on `react-native-gesture-handler` + `reanimated`
 * (both already dependencies) rather than `PanResponder`: the pan runs on the
 * UI thread, so the sheet tracks the finger even while Convex is re-rendering
 * the table underneath.
 *
 * Dismissing with unsaved edits asks first, matching the web. Deleting asks
 * too — the web deletes on a single tap here, which is a gap in it rather than
 * a convention worth copying.
 *
 * No 1RM maths in this file. `sets.update`, `.duplicate` and `.remove` each
 * call `recalcOneRepMax` server-side, which respects a manual override and
 * recomputes from the remaining sets — so an edit can legitimately *lower* your
 * tracked 1RM, unlike logging, which only ever raises it.
 */
import { useMutation } from "convex/react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Doc } from "../convex/api";
import { colors, radius, spacing } from "../theme";
import { Chip } from "./coach";
import { convexErrorMessage, useConfirm } from "./confirm-dialog";
import { AppText } from "./text";
import { useToast } from "./toast";

const SET_TYPES = ["warmup", "working", "drop", "failure"] as const;
type SetType = (typeof SET_TYPES)[number];

/** Past this many pixels down, releasing dismisses instead of springing back. */
const DISMISS_DISTANCE = 120;
/** A fast flick dismisses even if it never travelled that far. */
const DISMISS_VELOCITY = 800;

export function SetEditSheet({
	set,
	weightStep,
	exerciseName,
	onClose,
}: {
	/** The set being edited. Render this component only when one is selected. */
	set: Doc<"sets">;
	weightStep: number;
	exerciseName: string;
	onClose: () => void;
}) {
	const toast = useToast();
	const confirm = useConfirm();
	const insets = useSafeAreaInsets();

	const updateSet = useMutation(api.sets.update);
	const duplicateSet = useMutation(api.sets.duplicate);
	const removeSet = useMutation(api.sets.remove);

	const [weight, setWeight] = useState(set.weight);
	const [reps, setReps] = useState(set.reps);
	const [setType, setSetType] = useState<SetType>(set.setType);
	const [busy, setBusy] = useState(false);

	const dirty =
		weight !== set.weight || reps !== set.reps || setType !== set.setType;

	const translateY = useSharedValue(0);

	const requestClose = async () => {
		if (dirty) {
			const discard = await confirm({
				title: "Discard changes?",
				message: "Your edits to this set won't be saved.",
				confirmLabel: "Discard",
				cancelLabel: "Keep editing",
				destructive: true,
			});
			if (!discard) {
				translateY.value = withSpring(0);
				return;
			}
		}
		onClose();
	};

	const pan = Gesture.Pan()
		.onChange((event) => {
			// Downward only — dragging up should not lift the sheet off the screen.
			translateY.value = Math.max(0, translateY.value + event.changeY);
		})
		.onEnd((event) => {
			const shouldDismiss =
				translateY.value > DISMISS_DISTANCE ||
				event.velocityY > DISMISS_VELOCITY;
			if (shouldDismiss) {
				translateY.value = withTiming(600, { duration: 180 });
				runOnJS(requestClose)();
			} else {
				translateY.value = withSpring(0);
			}
		});

	const sheetStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value }],
	}));

	const save = async () => {
		if (!dirty || busy) return;
		setBusy(true);
		try {
			await updateSet({ id: set._id, weight, reps, setType });
			onClose();
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not save the set."));
		} finally {
			setBusy(false);
		}
	};

	const duplicate = async () => {
		if (busy) return;
		setBusy(true);
		try {
			await duplicateSet({ id: set._id });
			onClose();
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not duplicate the set."));
		} finally {
			setBusy(false);
		}
	};

	const remove = async () => {
		const confirmed = await confirm({
			title: "Delete this set?",
			message: "Your 1RM for this exercise is recalculated without it.",
			confirmLabel: "Delete set",
			destructive: true,
		});
		if (!confirmed) return;
		setBusy(true);
		try {
			await removeSet({ id: set._id });
			onClose();
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not delete the set."));
		} finally {
			setBusy(false);
		}
	};

	return (
		<View style={styles.overlay}>
			<Pressable style={styles.backdrop} onPress={() => void requestClose()} />

			<GestureDetector gesture={pan}>
				<Animated.View
					style={[
						styles.sheet,
						{ paddingBottom: insets.bottom + spacing.lg },
						sheetStyle,
					]}
				>
					<View style={styles.grabber} />

					<View style={styles.header}>
						<View style={styles.flex}>
							<AppText variant="heading">Set {set.setNumber}</AppText>
							<AppText variant="caption">{exerciseName}</AppText>
						</View>
						<Pressable
							onPress={() => void requestClose()}
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
						{SET_TYPES.map((t) => (
							<Pressable
								key={t}
								onPress={() => setSetType(t)}
								style={styles.flex}
							>
								<Chip label={t} active={t === setType} />
							</Pressable>
						))}
					</View>

					<View style={styles.steppers}>
						<Stepper
							label="kg"
							value={weight}
							step={weightStep}
							onChange={setWeight}
						/>
						<Stepper
							label="reps"
							value={reps}
							step={1}
							min={1}
							onChange={setReps}
						/>
					</View>

					<Pressable
						onPress={() => void save()}
						disabled={!dirty || busy}
						style={[styles.save, (!dirty || busy) && styles.dimmed]}
					>
						<AppText style={styles.saveText}>
							{busy ? "Saving…" : dirty ? "Save changes" : "No changes"}
						</AppText>
					</Pressable>

					<View style={styles.secondaryRow}>
						<Pressable
							onPress={() => void duplicate()}
							disabled={busy}
							style={[styles.ghost, busy && styles.dimmed]}
						>
							<AppText style={styles.ghostText}>Duplicate</AppText>
						</Pressable>
						<Pressable
							onPress={() => void remove()}
							disabled={busy}
							style={[styles.ghost, busy && styles.dimmed]}
						>
							<AppText style={styles.deleteText}>Delete</AppText>
						</Pressable>
					</View>
				</Animated.View>
			</GestureDetector>
		</View>
	);
}

function Stepper({
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
	onChange: (v: number) => void;
}) {
	const round = (n: number) => Math.round(n * 10) / 10;

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
	overlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		zIndex: 70,
	},
	backdrop: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "rgba(0, 0, 0, 0.6)",
	},
	sheet: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		gap: spacing.sm,
		backgroundColor: colors.surface,
		borderTopLeftRadius: radius.sheet,
		borderTopRightRadius: radius.sheet,
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
	},
	grabber: {
		alignSelf: "center",
		width: 36,
		height: 4,
		borderRadius: radius.pill,
		backgroundColor: colors.borderStrong,
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
