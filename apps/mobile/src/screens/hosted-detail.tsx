/**
 * The host's console for one hosted workout: the plan, the join code, the
 * lifecycle buttons, and the leaderboard. Ported from the web's
 * `src/routes/hosted-workouts/$id.tsx`, `HostedWorkoutDashboard.tsx` and
 * `HostedLeaderboard.tsx`.
 *
 * Editing the template is web-only — see the note in `hosted-list.tsx`. This
 * screen drives the states around it: draft → open → closed, plus delete.
 *
 * Leaderboard ranking uses `scoreRank` from `@foundry/core`, which is what
 * makes a capped For Time result sort below every finisher instead of looking
 * like a fast time.
 */
import { formatScore, scoreRank, type WodType } from "@foundry/core";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api, type Doc, type Id } from "../convex/api";
import { formatSessionDate } from "../data/session-data";
import { useI18n } from "../i18n";
import { radius, spacing, type Tokens, useThemedStyles } from "../theme";
import { Card, Chip, Eyebrow } from "../ui/coach";
import { convexErrorMessage, useConfirm } from "../ui/confirm-dialog";
import { ScreenHeader } from "../ui/screen-header";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

const LEVEL_LABEL: Record<string, string> = {
	rx: "Rx",
	l1: "L1",
	l2: "L2",
	l3: "L3",
};

export function HostedDetailScreen() {
	const styles = useThemedStyles(createStyles);
	const router = useRouter();
	const toast = useToast();
	const confirm = useConfirm();
	const copy = useI18n().t.hosted;
	const params = useLocalSearchParams<{ id?: string }>();
	const hostedId = params.id as Id<"hostedWorkouts"> | undefined;

	const data = useQuery(
		api.hostedWorkouts.getMine,
		hostedId ? { id: hostedId } : "skip",
	);

	const openWorkout = useMutation(api.hostedWorkouts.open);
	const closeWorkout = useMutation(api.hostedWorkouts.close);
	const removeWorkout = useMutation(api.hostedWorkouts.remove);
	const [busy, setBusy] = useState(false);

	const run = async (action: () => Promise<unknown>, fallback: string) => {
		if (busy) return;
		setBusy(true);
		try {
			await action();
		} catch (error) {
			toast.error(convexErrorMessage(error, fallback));
		} finally {
			setBusy(false);
		}
	};

	const close = async () => {
		const confirmed = await confirm({
			title: copy.closeTitle,
			message: copy.closeMessage,
			confirmLabel: copy.close,
		});
		if (!confirmed) return;
		if (!hostedId) return;
		await run(() => closeWorkout({ id: hostedId }), copy.closeError);
	};

	const remove = async () => {
		const confirmed = await confirm({
			title: copy.deleteTitle,
			message: copy.deleteMessage,
			confirmLabel: copy.deleteWorkout,
			destructive: true,
		});
		if (!confirmed || !hostedId) return;
		setBusy(true);
		try {
			await removeWorkout({ id: hostedId });
			router.back();
		} catch (error) {
			toast.error(convexErrorMessage(error, copy.deleteError));
		} finally {
			setBusy(false);
		}
	};

	if (data === undefined) {
		return (
			<View style={[styles.root, styles.centered]}>
				<AppText variant="caption">{copy.loading}</AppText>
			</View>
		);
	}

	if (data === null) {
		return (
			<View style={[styles.root, styles.centered]}>
				<AppText variant="heading">{copy.notFound}</AppText>
				<AppText variant="caption" style={styles.centeredText}>
					{copy.notFoundHint}
				</AppText>
			</View>
		);
	}

	const { hosted, participants, submissions } = data;

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<View style={styles.header}>
				<View style={styles.flex}>
					<ScreenHeader title={hosted.title} />
					<AppText variant="caption">
						{hosted.scheduledAt
							? formatSessionDate(hosted.scheduledAt)
							: formatSessionDate(hosted.createdAt)}
					</AppText>
				</View>
				<Chip
					label={copy.status[hosted.status]}
					active={hosted.status === "open"}
				/>
			</View>

			{hosted.status === "open" ? (
				<Card style={styles.tokenCard}>
					<Eyebrow>{copy.joinCode}</Eyebrow>
					<AppText style={styles.token} selectable>
						{hosted.joinToken}
					</AppText>
					<AppText variant="caption">{copy.joinCodeHint}</AppText>
				</Card>
			) : null}

			{hosted.notes ? (
				<Card>
					<AppText variant="body">{hosted.notes}</AppText>
				</Card>
			) : null}

			{hosted.template.strengthBlocks.length > 0 ? (
				<>
					<Eyebrow>{copy.strength}</Eyebrow>
					<View style={styles.list}>
						{hosted.template.strengthBlocks.map((block) => (
							<View key={block.blockId} style={styles.row}>
								<View style={styles.flex}>
									<AppText variant="body" style={styles.rowTitle}>
										{block.exerciseName}
									</AppText>
									<AppText variant="caption">
										{block.defaultSets ?? "—"} × {block.defaultReps ?? "—"}
										{block.percentageOfOneRepMax
											? ` · ${block.percentageOfOneRepMax}% 1RM`
											: block.defaultWeight
												? ` · ${block.defaultWeight} ${block.unit ?? "kg"}`
												: ""}
									</AppText>
								</View>
							</View>
						))}
					</View>
				</>
			) : null}

			{hosted.template.wodBlocks.map((block) => (
				<WodBlockBoard
					key={block.blockId}
					block={block}
					participants={participants}
					submissions={submissions}
				/>
			))}

			<View style={styles.actions}>
				{hosted.status === "draft" ? (
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ disabled: busy }}
						onPress={() =>
							hostedId &&
							run(() => openWorkout({ id: hostedId }), copy.openError)
						}
						disabled={busy}
						style={[styles.primaryBtn, busy && styles.dimmed]}
					>
						<AppText style={styles.primaryText}>{copy.open}</AppText>
					</Pressable>
				) : null}

				{hosted.status === "open" ? (
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ disabled: busy }}
						onPress={() => void close()}
						disabled={busy}
						style={[styles.primaryBtn, busy && styles.dimmed]}
					>
						<AppText style={styles.primaryText}>{copy.close}</AppText>
					</Pressable>
				) : null}

				<Pressable
					accessibilityRole="button"
					accessibilityState={{ disabled: busy }}
					onPress={() => void remove()}
					disabled={busy}
					style={[styles.ghostBtn, busy && styles.dimmed]}
				>
					<AppText style={styles.deleteText}>{copy.delete}</AppText>
				</Pressable>
			</View>
		</ScrollView>
	);
}

/** One WOD's leaderboard: everyone's score for that block, best first. */
function WodBlockBoard({
	block,
	participants,
	submissions,
}: {
	block: Doc<"hostedWorkouts">["template"]["wodBlocks"][number];
	participants: Doc<"hostedWorkoutParticipants">[];
	submissions: Doc<"hostedWorkoutSubmissions">[];
}) {
	const styles = useThemedStyles(createStyles);
	const copy = useI18n().t.hosted;
	const nameOf = useMemo(() => {
		const map = new Map<Id<"hostedWorkoutParticipants">, string>();
		for (const p of participants) {
			map.set(p._id, p.displayName ?? copy.athlete);
		}
		return map;
	}, [participants, copy.athlete]);

	const ranked = useMemo(() => {
		return submissions
			.filter((s) => s.wodBlockId === block.blockId)
			.map((s) => ({
				submission: s,
				name:
					s.guestName ?? nameOf.get(s.participantId as never) ?? copy.athlete,
				rank: scoreRank(block.type as WodType, s),
			}))
			.sort((a, b) => b.rank - a.rank);
	}, [submissions, block, nameOf, copy.athlete]);

	return (
		<>
			<Eyebrow>{block.name}</Eyebrow>
			{ranked.length === 0 ? (
				<AppText style={styles.muted}>{copy.noScores}</AppText>
			) : (
				<View style={styles.list}>
					{ranked.map((entry, index) => (
						<View key={entry.submission._id} style={styles.row}>
							<AppText style={styles.rank}>{index + 1}</AppText>
							<View style={styles.flex}>
								<AppText variant="body" style={styles.rowTitle}>
									{entry.name}
								</AppText>
								<AppText variant="caption">
									{LEVEL_LABEL[entry.submission.level] ??
										entry.submission.level}
									{entry.submission.notes ? ` · ${entry.submission.notes}` : ""}
								</AppText>
							</View>
							<AppText style={styles.score}>
								{formatScore(block.type as WodType, entry.submission)}
							</AppText>
						</View>
					))}
				</View>
			)}
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			padding: spacing.md,
			gap: spacing.sm,
			paddingBottom: spacing.xxl,
		},
		centered: {
			alignItems: "center",
			justifyContent: "center",
			gap: spacing.sm,
		},
		centeredText: { textAlign: "center" },
		header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
		flex: { flex: 1, gap: 2 },
		tokenCard: { gap: spacing.xs },
		token: {
			fontSize: 22,
			fontWeight: "800",
			color: colors.accent,
			letterSpacing: 1,
		},
		muted: { fontSize: 13, color: colors.textMuted },
		list: { gap: spacing.xs + 2 },
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			backgroundColor: colors.surface,
			borderRadius: radius.lg,
			padding: spacing.md,
		},
		rowTitle: { fontWeight: "700" },
		rank: {
			width: 20,
			fontSize: 13,
			fontWeight: "800",
			color: colors.textMuted,
		},
		score: { fontSize: 14, fontWeight: "800", color: colors.accent },
		actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
		primaryBtn: {
			flex: 1,
			minHeight: 48,
			borderRadius: radius.pill,
			backgroundColor: colors.accentFill,
			alignItems: "center",
			justifyContent: "center",
		},
		primaryText: { fontSize: 14, fontWeight: "800", color: colors.onAccent },
		ghostBtn: {
			minHeight: 48,
			paddingHorizontal: spacing.lg,
			borderRadius: radius.pill,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			alignItems: "center",
			justifyContent: "center",
		},
		ghostText: { fontSize: 13, fontWeight: "800", color: colors.text },
		deleteText: { fontSize: 13, fontWeight: "700", color: colors.danger },
		dimmed: { opacity: 0.5 },
	});
