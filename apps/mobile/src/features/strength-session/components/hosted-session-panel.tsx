/**
 * What a participant sees inside a hosted workout's session: the plan the host
 * set, and a score box per WOD block.
 *
 * Renders nothing at all unless `hostedWorkoutParticipants.getBySession` says
 * this session belongs to a hosted workout, so the ordinary strength session
 * screen is unchanged for everyone else.
 *
 * Submitting is an upsert server-side — sending a second score for the same
 * block replaces the first rather than stacking. That is what makes it safe to
 * correct a number without a delete step.
 */
import {
	buildWodScore,
	parseClockInput,
	validateWodScore,
} from "@foundry/core";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { fmt, parseLocalizedDecimal, useI18n } from "../../../i18n";
import { useConvexErrorMessage } from "../../../i18n/errors";
import {
	opacity,
	radius,
	spacing,
	type Tokens,
	type,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Card, Chip, Eyebrow } from "../../../ui/coach";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";

const LEVELS = ["rx", "l1", "l2", "l3"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_LABEL: Record<Level, string> = {
	rx: "Rx",
	l1: "L1",
	l2: "L2",
	l3: "L3",
};

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

	// Not a hosted session (or still loading) — render nothing, so the normal
	// logging screen looks exactly as it always does.
	if (!data) return null;

	const { hosted } = data;

	return (
		<View style={styles.wrap}>
			<Card style={styles.planCard}>
				<Eyebrow>{fmt(copy.panelHeading, { title: hosted.title })}</Eyebrow>
				{hosted.notes ? (
					<AppText variant="caption">{hosted.notes}</AppText>
				) : null}

				{hosted.template.strengthBlocks.map((block) => (
					<AppText key={block.blockId} variant="body" style={styles.planLine}>
						{block.exerciseName}
						{block.defaultSets && block.defaultReps
							? ` — ${block.defaultSets} × ${block.defaultReps}`
							: ""}
						{block.percentageOfOneRepMax
							? ` @ ${block.percentageOfOneRepMax}% 1RM`
							: ""}
					</AppText>
				))}
			</Card>

			{hosted.template.wodBlocks.map((block) => (
				<ScoreBox
					key={block.blockId}
					sessionId={sessionId}
					blockId={block.blockId}
					name={block.name}
					type={block.type}
					levels={block.levels}
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
	blockId,
	name,
	type,
	levels,
	busy,
	writable,
	write,
}: {
	sessionId: Id<"workoutSessions">;
	blockId: string;
	name: string;
	type: "forTime" | "amrap" | "emom" | "load";
	levels: { level: string; label: string; description?: string }[];
	busy: boolean;
	writable: boolean;
	write: (action: () => Promise<unknown>) => Promise<boolean>;
}) {
	const errorMessage = useConvexErrorMessage();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const toast = useToast();
	const copy = useI18n().t.hosted;
	const submit = useMutation(api.hostedWorkoutSubmissions.submitForSession);

	const [level, setLevel] = useState<Level>("rx");
	const [time, setTime] = useState("");
	const [rounds, setRounds] = useState("");
	const [reps, setReps] = useState("");
	const [load, setLoad] = useState("");
	const [capped, setCapped] = useState(false);
	const [notes, setNotes] = useState("");

	const chosen = levels.find((l) => l.level === level);

	const score = buildWodScore(type, {
		timeSeconds: parseClockInput(time),
		timeCapped: capped,
		rounds: parseLocalizedDecimal(rounds),
		reps: parseLocalizedDecimal(reps),
		load: parseLocalizedDecimal(load),
		loadUnit: "kg",
	});
	const complete = validateWodScore(type, score).ok;

	const send = async () => {
		if (busy || !writable || !complete) return;
		try {
			const saved = await write(() =>
				submit({
					sessionId,
					wodBlockId: blockId,
					level,
					...score,
					notes: notes.trim() === "" ? undefined : notes.trim(),
				}),
			);
			if (!saved) return;
			// The leaderboard is on the host's screen, not this one, so there is
			// nothing on-screen to confirm the submission landed.
			toast.success(fmt(copy.submitted, { name }));
		} catch (error) {
			toast.error(errorMessage(error, copy.submitError));
		}
	};

	return (
		<Card style={styles.scoreCard}>
			<AppText variant="heading">{name}</AppText>

			<View style={styles.chipRow}>
				{LEVELS.map((l) => (
					<Chip
						key={l}
						label={LEVEL_LABEL[l]}
						active={l === level}
						onPress={() => setLevel(l)}
					/>
				))}
			</View>

			{chosen?.description ? (
				<AppText variant="caption">{chosen.description}</AppText>
			) : null}

			{type === "forTime" ? (
				<>
					<View style={styles.selfStart}>
						<Chip
							label={copy.hitTimeCap}
							active={capped}
							onPress={() => setCapped(!capped)}
						/>
					</View>
					<TextInput
						value={capped ? reps : time}
						onChangeText={capped ? setReps : setTime}
						placeholder={capped ? copy.repsAtCap : copy.time}
						placeholderTextColor={colors.textFaint}
						style={styles.input}
						keyboardType={capped ? "number-pad" : "default"}
					/>
				</>
			) : null}

			{type === "amrap" ? (
				<View style={styles.formRow}>
					<TextInput
						value={rounds}
						onChangeText={setRounds}
						placeholder={copy.rounds}
						placeholderTextColor={colors.textFaint}
						style={[styles.input, styles.flex]}
						keyboardType="number-pad"
					/>
					<TextInput
						value={reps}
						onChangeText={setReps}
						placeholder={copy.plusReps}
						placeholderTextColor={colors.textFaint}
						style={[styles.input, styles.flex]}
						keyboardType="number-pad"
					/>
				</View>
			) : null}

			{type === "emom" ? (
				<TextInput
					value={reps}
					onChangeText={setReps}
					placeholder={copy.totalReps}
					placeholderTextColor={colors.textFaint}
					style={styles.input}
					keyboardType="number-pad"
				/>
			) : null}

			{type === "load" ? (
				<TextInput
					value={load}
					onChangeText={setLoad}
					placeholder={copy.load}
					placeholderTextColor={colors.textFaint}
					style={styles.input}
					keyboardType="decimal-pad"
				/>
			) : null}

			<TextInput
				value={notes}
				onChangeText={setNotes}
				placeholder={copy.notes}
				placeholderTextColor={colors.textFaint}
				style={styles.input}
			/>

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
		selfStart: { alignSelf: "flex-start" },
		formRow: { flexDirection: "row", gap: spacing.sm },
		flex: { flex: 1 },
		input: {
			minHeight: 48,
			borderRadius: radius.lg,
			paddingHorizontal: spacing.md,
			backgroundColor: colors.surface2,
			borderWidth: 1,
			borderColor: colors.border,
			color: colors.text,
			fontSize: type.body.fontSize,
		},
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
