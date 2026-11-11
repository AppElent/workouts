/**
 * What a participant sees inside a hosted workout's session: the plan the host
 * set, and a score box per WOD block. Renders nothing unless this session
 * belongs to a hosted workout.
 *
 * Submitting is an upsert server-side: a second score for the same block
 * replaces the first, so a number can be corrected without a delete step.
 */
import { type HostedLevel, hostedLevelLabel } from "@foundry/core";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { api, type Doc, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { fmt, useI18n } from "../../../i18n";
import {
	opacity,
	radius,
	spacing,
	type Tokens,
	type,
	useThemedStyles,
} from "../../../theme";
import { Card, Chip, Eyebrow } from "../../../ui/coach";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { useWriteFailureMessage } from "../../../ui/use-screen-write";
import { formatHostedPrescription } from "../../training/hosted/hosted-prescription";
import {
	useWodScoreDraft,
	WodScoreFields,
} from "../../training/wods/wod-score-fields";

type WodBlock = Doc<"hostedWorkouts">["template"]["wodBlocks"][number];

export function HostedSessionPanel({
	sessionId,
	busy,
	writable,
	write,
}: {
	sessionId: Id<"workoutSessions">;
	busy: boolean;
	writable: boolean;
	write: (action: () => Promise<unknown>) => Promise<boolean>;
}) {
	const styles = useThemedStyles(createStyles);
	const copy = useI18n().t.hosted;
	const data = useQuery(api.hostedWorkoutParticipants.getBySession, {
		sessionId,
	});

	// Not a hosted session, or still loading.
	if (!data) return null;

	const { hosted } = data;

	return (
		<View style={styles.wrap}>
			<Card style={styles.planCard}>
				<Eyebrow>{fmt(copy.panelHeading, { title: hosted.title })}</Eyebrow>
				{hosted.notes ? (
					<AppText variant="caption">{hosted.notes}</AppText>
				) : null}

				{hosted.template.strengthBlocks.map((block) => {
					const prescription = formatHostedPrescription(block);
					return (
						<AppText key={block.blockId} variant="body" style={styles.planLine}>
							{block.exerciseName}
							{prescription ? ` — ${prescription}` : ""}
						</AppText>
					);
				})}
			</Card>

			{hosted.template.wodBlocks.map((block) => (
				<ScoreBox
					key={block.blockId}
					sessionId={sessionId}
					block={block}
					busy={busy}
					writable={writable}
					write={write}
				/>
			))}
		</View>
	);
}

function ScoreBox({
	sessionId,
	block,
	busy,
	writable,
	write,
}: {
	sessionId: Id<"workoutSessions">;
	block: WodBlock;
	busy: boolean;
	writable: boolean;
	write: (action: () => Promise<unknown>) => Promise<boolean>;
}) {
	const errorMessage = useWriteFailureMessage();
	const styles = useThemedStyles(createStyles);
	const toast = useToast();
	const copy = useI18n().t.hosted;
	const submit = useMutation(api.hostedWorkoutSubmissions.submitForSession);
	const draft = useWodScoreDraft(block.type);
	const [level, setLevel] = useState<HostedLevel>("rx");
	const chosen = block.levels.find((l) => l.level === level);
	const complete = draft.complete;

	const send = async () => {
		if (busy || !writable || !complete) return;
		try {
			const saved = await write(() =>
				submit({
					sessionId,
					wodBlockId: block.blockId,
					level,
					...draft.score,
					notes: draft.notes,
				}),
			);
			if (!saved) return;
			// The leaderboard is on the host's screen, not this one, so there is
			// nothing on-screen to confirm the submission landed.
			toast.success(fmt(copy.submitted, { name: block.name }));
		} catch (error) {
			toast.error(errorMessage(error, copy.submitError));
		}
	};

	return (
		<Card style={styles.scoreCard}>
			<AppText variant="heading">{block.name}</AppText>

			<View style={styles.chipRow}>
				{block.levels.map((l) => (
					<Chip
						key={l.level}
						label={hostedLevelLabel(block.levels, l.level)}
						active={l.level === level}
						onPress={() => setLevel(l.level)}
					/>
				))}
			</View>

			{chosen?.description ? (
				<AppText variant="caption">{chosen.description}</AppText>
			) : null}

			<WodScoreFields draft={draft} inCard />

			<Pressable
				accessibilityRole="button"
				accessibilityState={{ disabled: busy || !writable }}
				onPress={() => void send()}
				disabled={busy || !writable || !complete}
				style={[styles.submit, busy && styles.dimmed]}
			>
				<AppText style={styles.submitText}>
					{busy ? copy.submitting : copy.submit}
				</AppText>
			</Pressable>
		</Card>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		wrap: { gap: spacing.sm },
		planCard: { gap: spacing.xs },
		planLine: { color: colors.textMuted },
		scoreCard: { gap: spacing.sm },
		chipRow: { flexDirection: "row", gap: spacing.xs + 2 },
		submit: {
			height: 48,
			borderRadius: radius.pill,
			backgroundColor: colors.accentFill,
			alignItems: "center",
			justifyContent: "center",
		},
		submitText: {
			fontSize: type.table.fontSize,
			fontWeight: "800",
			color: colors.onAccent,
		},
		dimmed: { opacity: opacity.disabled },
	});
