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
import { formatScore } from "@foundry/core";
import type { ExerciseId } from "@foundry/core/exercises";
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
import { fmt, useI18n } from "../i18n";
import { type Tokens, useThemedStyles, useTokens } from "../theme";
import { Eyebrow, StatBox } from "../ui/coach";
import { convexErrorMessage, useConfirm } from "../ui/confirm-dialog";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

export function SummaryScreen() {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const router = useRouter();
	const toast = useToast();
	const confirm = useConfirm();
	const copy = useI18n().t.workoutSummary;
	const params = useLocalSearchParams<{ id?: string }>();
	const sessionId = params.id as Id<"workoutSessions"> | undefined;

	const session = useSession(sessionId);
	const sets = useSessionSets(sessionId);
	const { exercises } = useShellData();
	const removeSession = useMutation(api.workoutSessions.remove);
	const [busy, setBusy] = useState(false);

	const nameById = useMemo(() => {
		const map = new Map<ExerciseId, string>();
		for (const e of exercises ?? []) map.set(e._id, e.name);
		return map;
	}, [exercises]);

	/** One group per exercise, in the order the session worked through them. */
	const groups = useMemo(() => {
		if (!sets) return [];
		return orderExercisesByFirstSet(sets).map((exerciseId) => ({
			exerciseId,
			name: nameById.get(exerciseId) ?? copy.exercise,
			sets: sets.filter((s) => s.exerciseId === exerciseId),
		}));
	}, [sets, nameById, copy.exercise]);

	const remove = async () => {
		if (!sessionId || busy) return;
		const confirmed = await confirm({
			title: copy.deleteTitle,
			message: copy.deleteMessage,
			confirmLabel: copy.delete,
			destructive: true,
		});
		if (!confirmed) return;
		setBusy(true);
		try {
			await removeSession({ id: sessionId });
			router.replace("/");
		} catch (error) {
			toast.error(convexErrorMessage(error, copy.deleteError));
		} finally {
			setBusy(false);
		}
	};

	if (session === undefined || sets === undefined) {
		return (
			<View style={[styles.root, styles.centered]}>
				<AppText variant="caption">{copy.loading}</AppText>
			</View>
		);
	}

	if (session === null) {
		return (
			<View style={[styles.root, styles.centered]}>
				<AppText variant="heading">{copy.notFound}</AppText>
				<Pressable
					accessibilityRole="button"
					onPress={() => router.replace("/")}
					style={styles.ghostBtn}
				>
					<AppText style={styles.ghostText}>{copy.backHome}</AppText>
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
						{cancelled ? copy.cancelled : copy.complete}
					</AppText>
				</View>
			</View>

			<AppText style={styles.h1}>{session.name ?? copy.freeSession}</AppText>
			<AppText style={styles.muted}>{formatSessionDate(session.date)}</AppText>

			<View style={styles.statRow}>
				<StatBox value={duration ?? "—"} label={copy.duration} />
				<StatBox value={String(sets.length)} label={copy.sets} />
				<StatBox
					value={volume > 0 ? String(Math.round(volume)) : "—"}
					unit={volume > 0 ? "kg" : undefined}
					label={copy.volume}
					color={colors.accent}
				/>
			</View>

			{groups.length === 0 ? (
				<AppText style={styles.muted}>{copy.noSets}</AppText>
			) : (
				<>
					<Eyebrow>{copy.exercises}</Eyebrow>
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

			<Pressable
				accessibilityRole="button"
				onPress={() => router.replace("/")}
				style={styles.doneBtn}
			>
				<AppText style={styles.doneText}>{copy.done}</AppText>
			</Pressable>

			<Pressable
				accessibilityRole="button"
				accessibilityState={{ disabled: busy }}
				onPress={() => void remove()}
				disabled={busy}
				style={[styles.deleteBtn, busy && styles.dimmed]}
			>
				<AppText style={styles.deleteText}>{copy.delete}</AppText>
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
	const styles = useThemedStyles(createStyles);
	const copy = useI18n().t.workoutSummary;
	const results = useQuery(
		api.wodResults.listForSession,
		sessionId ? { sessionId } : "skip",
	);
	const wods = useQuery(api.wods.list, {});

	if (!results || results.length === 0) return null;

	const nameById = new Map((wods ?? []).map((w) => [w._id, w]));

	return (
		<>
			<Eyebrow>{copy.wodResults}</Eyebrow>
			<View style={styles.list}>
				{results.map((r) => {
					const wod = nameById.get(r.wodId);
					return (
						<View key={r._id} style={styles.card}>
							<AppText style={styles.rowTitle}>{wod?.name ?? "WOD"}</AppText>
							<AppText style={styles.rowSub}>
								{wod ? formatScore(wod.type, r) : "—"} ·{" "}
								{r.rxScaled === "rx" ? copy.rx : copy.scaled}
							</AppText>
						</View>
					);
				})}
			</View>
		</>
	);
}

function ExerciseRecap({ name, sets }: { name: string; sets: Doc<"sets">[] }) {
	const styles = useThemedStyles(createStyles);
	const copy = useI18n().t.workoutSummary;
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
							{s.weight > 0
								? `${s.weight} × ${s.reps}`
								: fmt(copy.repsOnly, { reps: s.reps })}
						</AppText>
					</View>
				))}
			</View>
			{best && best.weight > 0 ? (
				<AppText style={styles.rowSub}>
					{fmt(copy.best, { weight: best.weight, reps: best.reps })}
				</AppText>
			) : null}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
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
		badgeMutedText: {
			fontSize: 11,
			fontWeight: "800",
			color: colors.textMuted,
		},
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
		warmupChip: { backgroundColor: colors.warnSoft },
		warmupChipText: { color: colors.warn },
		doneBtn: {
			height: 48,
			marginTop: 8,
			borderRadius: 9999,
			backgroundColor: colors.accentFill,
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
