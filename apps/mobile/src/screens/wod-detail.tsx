/**
 * One WOD: what it is, what you have scored on it, and a form to add another.
 * Ported from the web's `src/routes/wods/$id.tsx`, `LogWodResultForm.tsx` and
 * `WodResultHistory.tsx`.
 *
 * Scoring shape follows the type — a time for For Time, rounds-plus-reps for
 * AMRAP, reps for EMOM, a load for Load. Showing all four sets of fields at
 * once would be four ways to enter a score wrongly, so only the relevant pair
 * renders.
 *
 * Ranking and formatting both come from `@workouts/core`, the same functions
 * Convex uses server-side in `wodResults.getBest`.
 */
import { formatScore, prImprovement } from "@workouts/core";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { api, type Doc, type Id } from "../convex/api";
import { formatSessionDate } from "../data/session-data";
import { colors, radius, spacing } from "../theme";
import { Card, Chip, Eyebrow } from "../ui/coach";
import { convexErrorMessage, useConfirm } from "../ui/confirm-dialog";
import { ScreenHeader } from "../ui/screen-header";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { WodEditor } from "./wod-editor";
import { WOD_TYPE_LABEL } from "./wods-list";

/** "12:30" or "750" both mean 750 seconds. */
function parseTime(raw: string) {
	const trimmed = raw.trim();
	if (trimmed === "") return undefined;
	if (trimmed.includes(":")) {
		const [m, s] = trimmed.split(":");
		const minutes = Number.parseInt(m, 10);
		const seconds = Number.parseInt(s, 10);
		if (!Number.isFinite(minutes) || !Number.isFinite(seconds))
			return undefined;
		return minutes * 60 + seconds;
	}
	const parsed = Number.parseInt(trimmed, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseNumber(raw: string) {
	const parsed = Number.parseFloat(raw.trim());
	return Number.isFinite(parsed) ? parsed : undefined;
}

export function WodDetailScreen() {
	const router = useRouter();
	const toast = useToast();
	const confirm = useConfirm();
	const params = useLocalSearchParams<{ id?: string }>();
	const wodId = params.id as Id<"wods"> | undefined;

	const wod = useQuery(api.wods.getById, wodId ? { id: wodId } : "skip");
	const results = useQuery(
		api.wodResults.listForWod,
		wodId ? { wodId } : "skip",
	);
	const best = useQuery(api.wodResults.getBest, wodId ? { wodId } : "skip");

	const removeWod = useMutation(api.wods.remove);
	const removeResult = useMutation(api.wodResults.remove);
	const [editing, setEditing] = useState(false);

	const deleteWod = async () => {
		if (!wodId) return;
		const confirmed = await confirm({
			title: `Delete ${wod?.name ?? "this WOD"}?`,
			message: "Your logged results for it go too.",
			confirmLabel: "Delete WOD",
			destructive: true,
		});
		if (!confirmed) return;
		try {
			await removeWod({ id: wodId });
			router.back();
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not delete the WOD."));
		}
	};

	const deleteResult = async (id: Id<"wodResults">) => {
		const confirmed = await confirm({
			title: "Delete this result?",
			confirmLabel: "Delete result",
			destructive: true,
		});
		if (!confirmed) return;
		try {
			await removeResult({ id });
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not delete the result."));
		}
	};

	if (wod === undefined) {
		return (
			<View style={[styles.root, styles.centered]}>
				<AppText variant="caption">Loading…</AppText>
			</View>
		);
	}

	if (wod === null) {
		return (
			<View style={[styles.root, styles.centered]}>
				<AppText variant="heading">WOD not found</AppText>
			</View>
		);
	}

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
			keyboardShouldPersistTaps="handled"
		>
			<View style={styles.header}>
				<View style={styles.flex}>
					<ScreenHeader title={wod.name} />
					<AppText variant="caption">
						{WOD_TYPE_LABEL[wod.type]}
						{wod.isDefault ? " · benchmark" : ""}
					</AppText>
				</View>
			</View>

			<Card style={styles.detailCard}>
				{wod.repScheme ? (
					<AppText variant="body" style={styles.scheme}>
						{wod.repScheme}
					</AppText>
				) : null}
				{wod.movements.map((m) => (
					<AppText key={m.name} variant="body" style={styles.movement}>
						{m.reps ? `${m.reps} × ` : ""}
						{m.name}
					</AppText>
				))}
				{wod.timeCapSeconds ? (
					<AppText variant="caption">
						Time cap {Math.round(wod.timeCapSeconds / 60)} min
					</AppText>
				) : null}
				{wod.durationSeconds ? (
					<AppText variant="caption">
						{Math.round(wod.durationSeconds / 60)} min
					</AppText>
				) : null}
				{wod.description ? (
					<AppText variant="caption">{wod.description}</AppText>
				) : null}
			</Card>

			{best ? (
				<Card style={styles.bestCard}>
					<Eyebrow>Your best</Eyebrow>
					<AppText style={styles.bestValue}>
						{formatScore(wod.type, best)}
					</AppText>
					<AppText variant="caption">
						{best.rxScaled === "rx" ? "Rx" : "Scaled"} ·{" "}
						{formatSessionDate(best.date)}
					</AppText>
				</Card>
			) : null}

			<LogResultForm wod={wod} best={best ?? null} />

			<Eyebrow>History</Eyebrow>
			{results === undefined ? (
				<AppText style={styles.muted}>Loading…</AppText>
			) : results.length === 0 ? (
				<AppText style={styles.muted}>Nothing logged yet.</AppText>
			) : (
				<View style={styles.list}>
					{[...results].reverse().map((r) => (
						<View key={r._id} style={styles.row}>
							<View style={styles.flex}>
								<AppText variant="body" style={styles.rowTitle}>
									{formatScore(wod.type, r)}
								</AppText>
								<AppText variant="caption">
									{r.rxScaled === "rx" ? "Rx" : "Scaled"} ·{" "}
									{formatSessionDate(r.date)}
									{r.notes ? ` · ${r.notes}` : ""}
								</AppText>
							</View>
							<Pressable
								onPress={() => void deleteResult(r._id)}
								hitSlop={12}
								accessibilityRole="button"
								accessibilityLabel="Delete result"
							>
								<AppText variant="caption" style={styles.delete}>
									Delete
								</AppText>
							</Pressable>
						</View>
					))}
				</View>
			)}

			{wod.isDefault ? null : (
				<View style={styles.actions}>
					<Pressable onPress={() => setEditing(true)} style={styles.ghostBtn}>
						<AppText style={styles.ghostText}>Edit</AppText>
					</Pressable>
					<Pressable onPress={() => void deleteWod()} style={styles.ghostBtn}>
						<AppText style={styles.deleteText}>Delete WOD</AppText>
					</Pressable>
				</View>
			)}

			{editing ? (
				<WodEditor visible wod={wod} onClose={() => setEditing(false)} />
			) : null}
		</ScrollView>
	);
}

function LogResultForm({
	wod,
	best,
}: {
	wod: Doc<"wods">;
	best: Doc<"wodResults"> | null;
}) {
	const toast = useToast();
	const logResult = useMutation(api.wodResults.log);

	const [time, setTime] = useState("");
	const [rounds, setRounds] = useState("");
	const [reps, setReps] = useState("");
	const [load, setLoad] = useState("");
	const [capped, setCapped] = useState(false);
	const [rx, setRx] = useState(true);
	const [notes, setNotes] = useState("");
	const [busy, setBusy] = useState(false);

	const submit = async () => {
		if (busy) return;
		const score = {
			timeSeconds: wod.type === "forTime" ? parseTime(time) : undefined,
			rounds: wod.type === "amrap" ? parseNumber(rounds) : undefined,
			reps:
				wod.type === "amrap" || wod.type === "emom" || capped
					? parseNumber(reps)
					: undefined,
			timeCapped: wod.type === "forTime" ? capped : undefined,
			load: wod.type === "load" ? parseNumber(load) : undefined,
			loadUnit: wod.type === "load" ? ("kg" as const) : undefined,
		};

		setBusy(true);
		try {
			await logResult({
				wodId: wod._id,
				rxScaled: rx ? "rx" : "scaled",
				notes: notes.trim() === "" ? undefined : notes.trim(),
				...score,
			});
			// A new personal best is worth saying out loud — it is the one outcome
			// the history list below does not make obvious at a glance.
			const improvement = best ? prImprovement(wod.type, score, best) : null;
			if (improvement) toast.success(`New PR — ${improvement}`);
			setTime("");
			setRounds("");
			setReps("");
			setLoad("");
			setNotes("");
			setCapped(false);
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not log the result."));
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<Eyebrow>Log a result</Eyebrow>

			<View style={styles.chipRow}>
				<Pressable onPress={() => setRx(true)}>
					<Chip label="Rx" active={rx} />
				</Pressable>
				<Pressable onPress={() => setRx(false)}>
					<Chip label="Scaled" active={!rx} />
				</Pressable>
			</View>

			{wod.type === "forTime" ? (
				<>
					<View style={styles.chipRow}>
						<Pressable onPress={() => setCapped(!capped)}>
							<Chip label="Hit the time cap" active={capped} />
						</Pressable>
					</View>
					{capped ? (
						<TextInput
							value={reps}
							onChangeText={setReps}
							placeholder="Reps completed at the cap"
							placeholderTextColor={colors.textFaint}
							style={styles.input}
							keyboardType="number-pad"
						/>
					) : (
						<TextInput
							value={time}
							onChangeText={setTime}
							placeholder="Time — 8:42"
							placeholderTextColor={colors.textFaint}
							style={styles.input}
						/>
					)}
				</>
			) : null}

			{wod.type === "amrap" ? (
				<View style={styles.formRow}>
					<TextInput
						value={rounds}
						onChangeText={setRounds}
						placeholder="Rounds"
						placeholderTextColor={colors.textFaint}
						style={[styles.input, styles.flex]}
						keyboardType="number-pad"
					/>
					<TextInput
						value={reps}
						onChangeText={setReps}
						placeholder="+ reps"
						placeholderTextColor={colors.textFaint}
						style={[styles.input, styles.flex]}
						keyboardType="number-pad"
					/>
				</View>
			) : null}

			{wod.type === "emom" ? (
				<TextInput
					value={reps}
					onChangeText={setReps}
					placeholder="Total reps"
					placeholderTextColor={colors.textFaint}
					style={styles.input}
					keyboardType="number-pad"
				/>
			) : null}

			{wod.type === "load" ? (
				<TextInput
					value={load}
					onChangeText={setLoad}
					placeholder="Load (kg)"
					placeholderTextColor={colors.textFaint}
					style={styles.input}
					keyboardType="decimal-pad"
				/>
			) : null}

			<TextInput
				value={notes}
				onChangeText={setNotes}
				placeholder="Notes (optional)"
				placeholderTextColor={colors.textFaint}
				style={styles.input}
			/>

			<Pressable
				onPress={() => void submit()}
				disabled={busy}
				style={[styles.submit, busy && styles.dimmed]}
			>
				<AppText style={styles.submitText}>
					{busy ? "Logging…" : "Log result"}
				</AppText>
			</Pressable>
		</>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
	centered: { alignItems: "center", justifyContent: "center", gap: spacing.sm },
	header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	flex: { flex: 1, gap: 2 },
	detailCard: { gap: spacing.xs },
	scheme: { fontWeight: "800", color: colors.accent },
	movement: { color: colors.textMuted },
	bestCard: { gap: 2 },
	bestValue: { fontSize: 28, fontWeight: "800", color: colors.text },
	chipRow: { flexDirection: "row", gap: spacing.xs + 2 },
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
	rowTitle: { fontWeight: "800" },
	delete: { color: colors.danger, fontWeight: "700" },
	actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
	ghostBtn: {
		flex: 1,
		minHeight: 44,
		borderRadius: radius.pill,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		alignItems: "center",
		justifyContent: "center",
	},
	ghostText: { fontSize: 13, fontWeight: "800", color: colors.text },
	deleteText: { fontSize: 13, fontWeight: "700", color: colors.danger },
});
