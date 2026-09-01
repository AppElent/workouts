/**
 * The post-session recap, ported from the web's
 * `src/components/session/SessionSummary.tsx`.
 *
 * Reads the finished session back from Convex rather than being handed totals
 * by the log screen. That costs a round trip, and buys the guarantee that these
 * numbers are the ones actually stored — a summary computed from the screen it
 * followed can only ever confirm that screen agreed with itself.
 *
 * Volume counts working sets only, matching the web. Warmups and drop sets are
 * real work but not the number anyone compares week to week.
 *
 * The WOD-results section the web shows below the exercise breakdown is not
 * here yet; it lands with the WOD screens.
 */
import { formatScore } from "@workouts/core";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api, type Doc, type Id } from "../convex/api";
import {
	formatDuration,
	formatSessionDate,
	orderExercisesByFirstSet,
	useSession,
	useSessionSets,
	useShellData,
	workingVolume,
} from "../data/session-data";
import { colors } from "../theme";
import { Eyebrow, StatBox } from "../ui/coach";
import { convexErrorMessage, useConfirm } from "../ui/confirm-dialog";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

export function SummaryScreen() {
	const router = useRouter();
	const toast = useToast();
	const confirm = useConfirm();
	const params = useLocalSearchParams<{ id?: string }>();
	const sessionId = params.id as Id<"workoutSessions"> | undefined;

	const session = useSession(sessionId);
	const sets = useSessionSets(sessionId);
	const { exercises } = useShellData();
	const removeSession = useMutation(api.workoutSessions.remove);
	const [busy, setBusy] = useState(false);

	const nameById = useMemo(() => {
		const map = new Map<Id<"exercises">, string>();
		for (const e of exercises ?? []) map.set(e._id, e.name);
		return map;
	}, [exercises]);

	/** One group per exercise, in the order the session worked through them. */
	const groups = useMemo(() => {
		if (!sets) return [];
		return orderExercisesByFirstSet(sets).map((exerciseId) => ({
			exerciseId,
			name: nameById.get(exerciseId) ?? "Exercise",
			sets: sets.filter((s) => s.exerciseId === exerciseId),
		}));
	}, [sets, nameById]);

	const remove = async () => {
		if (!sessionId || busy) return;
		const confirmed = await confirm({
			title: "Delete this workout?",
			message: "Every set logged in it goes too. This cannot be undone.",
			confirmLabel: "Delete workout",
			destructive: true,
		});
		if (!confirmed) return;
		setBusy(true);
		try {
			await removeSession({ id: sessionId });
			router.replace("/");
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not delete the session."));
		} finally {
			setBusy(false);
		}
	};

	if (session === undefined || sets === undefined) {
		return (
			<View style={[styles.root, styles.centered]}>
				<AppText variant="caption">Loading…</AppText>
			</View>
		);
	}

	if (session === null) {
		return (
			<View style={[styles.root, styles.centered]}>
				<AppText variant="heading">Session not found</AppText>
				<Pressable onPress={() => router.replace("/")} style={styles.ghostBtn}>
					<AppText style={styles.ghostText}>Back to home</AppText>
				</Pressable>
			</View>
		);
	}

	const cancelled = session.status === "cancelled";
	const duration = formatDuration(session.startTime, session.endTime);
	const volume = workingVolume(sets);

	return (
		<ScrollView
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<View style={styles.badgeRow}>
				<View style={[styles.badge, cancelled ? styles.badgeMuted : null]}>
					<AppText style={cancelled ? styles.badgeMutedText : styles.badgeText}>
						{cancelled ? "Workout cancelled" : "Workout complete"}
					</AppText>
				</View>
			</View>

			<AppText style={styles.h1}>{session.name ?? "Free session"}</AppText>
			<AppText style={styles.muted}>{formatSessionDate(session.date)}</AppText>

			<View style={styles.statRow}>
				<StatBox value={duration ?? "—"} label="Duration" />
				<StatBox value={String(sets.length)} label="Sets" />
				<StatBox
					value={volume > 0 ? String(Math.round(volume)) : "—"}
					unit={volume > 0 ? "kg" : undefined}
					label="Volume"
					color={colors.accent}
				/>
			</View>

			{groups.length === 0 ? (
				<AppText style={styles.muted}>
					No sets were logged in this session.
				</AppText>
			) : (
				<>
					<Eyebrow>Exercises</Eyebrow>
					<View style={styles.list}>
						{groups.map((group) => (
							<ExerciseRecap
								key={group.exerciseId}
								name={group.name}
								sets={group.sets}
							/>
						))}
					</View>
				</>
			)}

			<SessionWodResults sessionId={sessionId} />

			<Pressable onPress={() => router.replace("/")} style={styles.doneBtn}>
				<AppText style={styles.doneText}>Done</AppText>
			</Pressable>

			<Pressable
				onPress={() => void remove()}
				disabled={busy}
				style={[styles.deleteBtn, busy && styles.dimmed]}
			>
				<AppText style={styles.deleteText}>Delete workout</AppText>
			</Pressable>
		</ScrollView>
	);
}

/**
 * WOD scores logged against this session. Fills the slot Phase 1 left open;
 * renders nothing when the session had no WODs, which is most of them.
 */
function SessionWodResults({
	sessionId,
}: {
	sessionId: Id<"workoutSessions"> | undefined;
}) {
	const results = useQuery(
		api.wodResults.listForSession,
		sessionId ? { sessionId } : "skip",
	);
	const wods = useQuery(api.wods.list, {});

	if (!results || results.length === 0) return null;

	const nameById = new Map((wods ?? []).map((w) => [w._id, w]));

	return (
		<>
			<Eyebrow>WOD results</Eyebrow>
			<View style={styles.list}>
				{results.map((r) => {
					const wod = nameById.get(r.wodId);
					return (
						<View key={r._id} style={styles.card}>
							<AppText style={styles.rowTitle}>{wod?.name ?? "WOD"}</AppText>
							<AppText style={styles.rowSub}>
								{wod ? formatScore(wod.type, r) : "—"} ·{" "}
								{r.rxScaled === "rx" ? "Rx" : "Scaled"}
							</AppText>
						</View>
					);
				})}
			</View>
		</>
	);
}

function ExerciseRecap({ name, sets }: { name: string; sets: Doc<"sets">[] }) {
	// "Best" is the heaviest set, matching the web. Not the same as the highest
	// estimated 1RM — a heavy double can out-rank a heavier single there.
	const best = sets.reduce(
		(top, s) => (s.weight > top.weight ? s : top),
		sets[0],
	);

	return (
		<View style={styles.card}>
			<AppText style={styles.rowTitle}>{name}</AppText>
			<View style={styles.chipWrap}>
				{sets.map((s) => (
					<View
						key={s._id}
						style={[
							styles.setChip,
							s.setType === "warmup" && styles.warmupChip,
						]}
					>
						<AppText
							style={[
								styles.setChipText,
								s.setType === "warmup" && styles.warmupChipText,
							]}
						>
							{s.weight > 0 ? `${s.weight} × ${s.reps}` : `${s.reps} reps`}
						</AppText>
					</View>
				))}
			</View>
			{best && best.weight > 0 ? (
				<AppText style={styles.rowSub}>
					Best: {best.weight} kg × {best.reps}
				</AppText>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingTop: 16, gap: 12, paddingBottom: 60 },
	centered: { alignItems: "center", justifyContent: "center", gap: 12 },
	badgeRow: { flexDirection: "row" },
	badge: {
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 9999,
		backgroundColor: colors.accentDim,
		borderWidth: 1,
		borderColor: colors.accent,
	},
	badgeText: { fontSize: 11, fontWeight: "800", color: colors.accent },
	badgeMuted: {
		backgroundColor: colors.surface2,
		borderColor: colors.borderStrong,
	},
	badgeMutedText: { fontSize: 11, fontWeight: "800", color: colors.textMuted },
	h1: { fontSize: 24, fontWeight: "800", color: colors.text },
	muted: { fontSize: 13, color: colors.textMuted },
	statRow: { flexDirection: "row", gap: 8, marginTop: 4 },
	list: { gap: 8 },
	card: {
		gap: 6,
		backgroundColor: colors.surface,
		borderRadius: 14,
		padding: 12,
	},
	rowTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
	rowSub: { fontSize: 11, color: colors.textMuted },
	chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
	setChip: {
		paddingVertical: 4,
		paddingHorizontal: 9,
		borderRadius: 9999,
		backgroundColor: colors.surface2,
	},
	setChipText: { fontSize: 11, fontWeight: "700", color: colors.text },
	warmupChip: { backgroundColor: "rgba(251, 191, 36, 0.12)" },
	warmupChipText: { color: colors.warn },
	doneBtn: {
		height: 48,
		marginTop: 8,
		borderRadius: 9999,
		backgroundColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	doneText: { fontSize: 15, fontWeight: "800", color: colors.onAccent },
	deleteBtn: {
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	deleteText: { fontSize: 13, fontWeight: "700", color: colors.danger },
	dimmed: { opacity: 0.5 },
	ghostBtn: {
		minHeight: 44,
		paddingHorizontal: 20,
		borderRadius: 9999,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		alignItems: "center",
		justifyContent: "center",
	},
	ghostText: { fontSize: 13, fontWeight: "800", color: colors.text },
});
