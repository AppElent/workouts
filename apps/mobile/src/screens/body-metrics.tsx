/**
 * Body metrics, ported from the web's
 * `src/components/progress/BodyMetricsPanel.tsx`.
 *
 * Every field is optional and the backend rejects an entry where all of them
 * are empty ("Enter at least one measurement."), so the form mirrors that: the
 * save button stays disabled until something is filled in, rather than letting
 * the user submit into a guaranteed error.
 *
 * Ranges are enforced server-side by `assertOptionalRange`. Nothing is
 * re-validated here — a second copy of the bounds is a second thing to keep in
 * step, and the toast surfaces the server's message verbatim.
 */
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { api, type Id } from "../convex/api";
import { formatSessionDate } from "../data/session-data";
import { colors, radius, spacing } from "../theme";
import { TrendChart } from "../ui/chart";
import { Eyebrow, StatBox } from "../ui/coach";
import { convexErrorMessage, useConfirm } from "../ui/confirm-dialog";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

/** Parses a field, treating blank and nonsense alike as "not provided". */
function optionalNumber(raw: string) {
	const trimmed = raw.trim();
	if (trimmed === "") return undefined;
	const parsed = Number.parseFloat(trimmed);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export function BodyMetricsPanel() {
	const toast = useToast();
	const confirm = useConfirm();
	const entries = useQuery(api.bodyMetrics.list, {});
	const addEntry = useMutation(api.bodyMetrics.add);
	const removeEntry = useMutation(api.bodyMetrics.remove);

	const [weight, setWeight] = useState("");
	const [bodyFat, setBodyFat] = useState("");
	const [notes, setNotes] = useState("");
	const [busy, setBusy] = useState(false);

	// `list` comes back newest-first; a trend reads left-to-right in time.
	const weightPoints = useMemo(
		() =>
			[...(entries ?? [])]
				.reverse()
				.filter((e) => e.weight !== undefined)
				.map((e) => ({
					value: e.weight as number,
					label: new Date(e.date).toLocaleDateString(undefined, {
						day: "numeric",
						month: "short",
					}),
				})),
		[entries],
	);

	const latest = entries?.[0];
	const canSave =
		!busy &&
		(optionalNumber(weight) !== undefined ||
			optionalNumber(bodyFat) !== undefined);

	const save = async () => {
		if (!canSave) return;
		setBusy(true);
		try {
			await addEntry({
				weight: optionalNumber(weight),
				bodyFatPct: optionalNumber(bodyFat),
				unit: "kg",
				notes: notes.trim() === "" ? undefined : notes.trim(),
			});
			setWeight("");
			setBodyFat("");
			setNotes("");
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not save the entry."));
		} finally {
			setBusy(false);
		}
	};

	const remove = async (id: Id<"bodyMetrics">, date: number) => {
		const confirmed = await confirm({
			title: "Delete this entry?",
			message: formatSessionDate(date),
			confirmLabel: "Delete entry",
			destructive: true,
		});
		if (!confirmed) return;
		try {
			await removeEntry({ id });
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not delete the entry."));
		}
	};

	return (
		<>
			{latest ? (
				<View style={styles.statRow}>
					<StatBox
						value={latest.weight !== undefined ? String(latest.weight) : "—"}
						unit={latest.weight !== undefined ? latest.unit : undefined}
						label="Weight"
					/>
					<StatBox
						value={
							latest.bodyFatPct !== undefined ? String(latest.bodyFatPct) : "—"
						}
						unit={latest.bodyFatPct !== undefined ? "%" : undefined}
						label="Body fat"
					/>
				</View>
			) : null}

			<TrendChart title="Weight over time" points={weightPoints} />

			<Eyebrow>Log an entry</Eyebrow>
			<View style={styles.formRow}>
				<TextInput
					value={weight}
					onChangeText={setWeight}
					placeholder="Weight (kg)"
					placeholderTextColor={colors.textFaint}
					style={[styles.input, styles.flex]}
					keyboardType="decimal-pad"
				/>
				<TextInput
					value={bodyFat}
					onChangeText={setBodyFat}
					placeholder="Body fat %"
					placeholderTextColor={colors.textFaint}
					style={[styles.input, styles.flex]}
					keyboardType="decimal-pad"
				/>
			</View>
			<TextInput
				value={notes}
				onChangeText={setNotes}
				placeholder="Notes (optional)"
				placeholderTextColor={colors.textFaint}
				style={styles.input}
			/>
			<Pressable
				onPress={() => void save()}
				disabled={!canSave}
				style={[styles.submit, !canSave && styles.dimmed]}
			>
				<AppText style={styles.submitText}>
					{busy ? "Saving…" : "Save entry"}
				</AppText>
			</Pressable>

			{entries === undefined ? (
				<AppText style={styles.muted}>Loading…</AppText>
			) : entries.length === 0 ? (
				<AppText style={styles.muted}>
					Nothing logged yet — the first entry starts the trend.
				</AppText>
			) : (
				<>
					<Eyebrow>History</Eyebrow>
					<View style={styles.list}>
						{entries.map((e) => (
							<View key={e._id} style={styles.row}>
								<View style={styles.flex}>
									<AppText variant="body" style={styles.rowTitle}>
										{e.weight !== undefined ? `${e.weight} ${e.unit}` : "—"}
										{e.bodyFatPct !== undefined ? ` · ${e.bodyFatPct}%` : ""}
									</AppText>
									<AppText variant="caption">
										{formatSessionDate(e.date)}
										{e.notes ? ` · ${e.notes}` : ""}
									</AppText>
								</View>
								<Pressable
									onPress={() => void remove(e._id, e.date)}
									hitSlop={12}
									accessibilityRole="button"
									accessibilityLabel="Delete entry"
								>
									<AppText variant="caption" style={styles.delete}>
										Delete
									</AppText>
								</Pressable>
							</View>
						))}
					</View>
				</>
			)}
		</>
	);
}

const styles = StyleSheet.create({
	statRow: { flexDirection: "row", gap: spacing.sm },
	flex: { flex: 1 },
	formRow: { flexDirection: "row", gap: spacing.sm },
	input: {
		minHeight: 48,
		borderRadius: radius.lg,
		paddingHorizontal: spacing.md,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		color: colors.text,
		fontSize: 15,
	},
	submit: {
		height: 48,
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	submitText: { fontSize: 15, fontWeight: "800", color: colors.onAccent },
	dimmed: { opacity: 0.5 },
	muted: { fontSize: 13, color: colors.textMuted },
	list: { gap: spacing.sm },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		padding: spacing.md,
	},
	rowTitle: { fontWeight: "700" },
	delete: { color: colors.danger, fontWeight: "700" },
});
