/**
 * The post-session recap. Reads the finished session back from Convex so the
 * numbers shown are the ones actually stored.
 */
import {
	formatDurationMinutes,
	formatScore,
	workingVolume,
} from "@foundry/core";
import type { ExerciseId } from "@foundry/core/exercises";
import { useMutation } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api, type Doc, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { useExercises } from "../../../data/exercises";
import {
	formatSessionDate,
	orderExercisesByFirstSet,
	useSession,
	useSessionSets,
} from "../../../data/session-data";
import { fmt, useI18n } from "../../../i18n";
import { convexErrorMessage } from "../../../i18n/errors";
import {
	opacity,
	type Tokens,
	type,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Eyebrow, StatBox } from "../../../ui/coach";
import { useConfirm } from "../../../ui/confirm-dialog";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";

export function SessionSummaryScreen() {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const router = useRouter();
	const toast = useToast();
	const confirm = useConfirm();
	const { locale, t } = useI18n();
	const copy = t.workoutSummary;
	const params = useLocalSearchParams<{ id?: string }>();
	const sessionId = params.id as Id<"workoutSessions"> | undefined;

	const session = useSession(sessionId);
	const sets = useSessionSets(sessionId);
	const exercises = useExercises();
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
			router.back();
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
					onPress={() => router.back()}
					style={styles.ghostBtn}
				>
					<AppText style={styles.ghostText}>{copy.back}</AppText>
				</Pressable>
			</View>
		);
	}

	const cancelled = session.status === "cancelled";
	const duration = session.endTime
		? formatDurationMinutes(session.endTime - session.startTime)
		: null;
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
			<AppText style={styles.muted}>
				{formatSessionDate(session.date, locale)}
			</AppText>

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
				onPress={() => router.back()}
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
		badgeText: {
			fontSize: type.micro.fontSize,
			fontWeight: "800",
			color: colors.accent,
		},
		badgeMuted: {
			backgroundColor: colors.surface2,
			borderColor: colors.borderStrong,
		},
		badgeMutedText: {
			fontSize: type.micro.fontSize,
			fontWeight: "800",
			color: colors.textMuted,
		},
		h1: {
			fontSize: type.title.fontSize,
			fontWeight: "800",
			color: colors.text,
		},
		muted: { fontSize: type.footnote.fontSize, color: colors.textMuted },
		statRow: { flexDirection: "row", gap: 8, marginTop: 4 },
		list: { gap: 8 },
		card: {
			gap: 6,
			backgroundColor: colors.surface,
			borderRadius: 14,
			padding: 12,
		},
		rowTitle: {
			fontSize: type.table.fontSize,
			fontWeight: "700",
			color: colors.text,
		},
		rowSub: { fontSize: type.caption.fontSize, color: colors.textMuted },
		chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
		setChip: {
			paddingVertical: 4,
			paddingHorizontal: 9,
			borderRadius: 9999,
			backgroundColor: colors.surface2,
		},
		setChipText: {
			fontSize: type.micro.fontSize,
			fontWeight: "700",
			color: colors.text,
		},
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
		doneText: {
			fontSize: type.body.fontSize,
			fontWeight: "800",
			color: colors.onAccent,
		},
		deleteBtn: {
			minHeight: 44,
			alignItems: "center",
			justifyContent: "center",
		},
		deleteText: {
			fontSize: type.footnote.fontSize,
			fontWeight: "700",
			color: colors.danger,
		},
		dimmed: { opacity: opacity.disabled },
		ghostBtn: {
			minHeight: 44,
			paddingHorizontal: 20,
			borderRadius: 9999,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			alignItems: "center",
			justifyContent: "center",
		},
		ghostText: {
			fontSize: type.footnote.fontSize,
			fontWeight: "800",
			color: colors.text,
		},
	});
