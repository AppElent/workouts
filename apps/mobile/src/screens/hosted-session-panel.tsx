/**
 * What a participant sees inside a hosted workout's session: the plan the host
 * set, and a score box per WOD block. Ported from the web's
 * `HostedSessionPlan.tsx` and `HostedScoreForm.tsx`.
 *
 * Renders nothing at all unless `hostedWorkoutParticipants.getBySession` says
 * this session belongs to a hosted workout, so the ordinary strength session
 * screen is unchanged for everyone else.
 *
 * Submitting is an upsert server-side — sending a second score for the same
 * block replaces the first rather than stacking. That is what makes it safe to
 * correct a number without a delete step.
 */
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { api, type Id } from "../convex/api";
import { colors, radius, spacing } from "../theme";
import { Card, Chip, Eyebrow } from "../ui/coach";
import { convexErrorMessage } from "../ui/confirm-dialog";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

const LEVELS = ["rx", "l1", "l2", "l3"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_LABEL: Record<Level, string> = {
	rx: "Rx",
	l1: "L1",
	l2: "L2",
	l3: "L3",
};

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

export function HostedSessionPanel({
	sessionId,
}: {
	sessionId: Id<"workoutSessions">;
}) {
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
				<Eyebrow>Hosted · {hosted.title}</Eyebrow>
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
}: {
	sessionId: Id<"workoutSessions">;
	blockId: string;
	name: string;
	type: "forTime" | "amrap" | "emom" | "load";
	levels: { level: string; label: string; description?: string }[];
}) {
	const toast = useToast();
	const submit = useMutation(api.hostedWorkoutSubmissions.submitForSession);

	const [level, setLevel] = useState<Level>("rx");
	const [time, setTime] = useState("");
	const [rounds, setRounds] = useState("");
	const [reps, setReps] = useState("");
	const [load, setLoad] = useState("");
	const [capped, setCapped] = useState(false);
	const [notes, setNotes] = useState("");
	const [busy, setBusy] = useState(false);

	const chosen = levels.find((l) => l.level === level);

	const send = async () => {
		if (busy) return;
		setBusy(true);
		try {
			await submit({
				sessionId,
				wodBlockId: blockId,
				level,
				timeSeconds: type === "forTime" ? parseTime(time) : undefined,
				rounds: type === "amrap" ? parseNumber(rounds) : undefined,
				reps:
					type === "amrap" || type === "emom" || capped
						? parseNumber(reps)
						: undefined,
				timeCapped: type === "forTime" ? capped : undefined,
				load: type === "load" ? parseNumber(load) : undefined,
				loadUnit: type === "load" ? "kg" : undefined,
				notes: notes.trim() === "" ? undefined : notes.trim(),
			});
			// The leaderboard is on the host's screen, not this one, so there is
			// nothing on-screen to confirm the submission landed.
			toast.success(`Score submitted for ${name}`);
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not submit your score."));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card style={styles.scoreCard}>
			<AppText variant="heading">{name}</AppText>

			<View style={styles.chipRow}>
				{LEVELS.map((l) => (
					<Pressable key={l} onPress={() => setLevel(l)}>
						<Chip label={LEVEL_LABEL[l]} active={l === level} />
					</Pressable>
				))}
			</View>

			{chosen?.description ? (
				<AppText variant="caption">{chosen.description}</AppText>
			) : null}

			{type === "forTime" ? (
				<>
					<Pressable
						onPress={() => setCapped(!capped)}
						style={styles.selfStart}
					>
						<Chip label="Hit the time cap" active={capped} />
					</Pressable>
					<TextInput
						value={capped ? reps : time}
						onChangeText={capped ? setReps : setTime}
						placeholder={capped ? "Reps at the cap" : "Time — 8:42"}
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

			{type === "emom" ? (
				<TextInput
					value={reps}
					onChangeText={setReps}
					placeholder="Total reps"
					placeholderTextColor={colors.textFaint}
					style={styles.input}
					keyboardType="number-pad"
				/>
			) : null}

			{type === "load" ? (
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
				onPress={() => void send()}
				disabled={busy}
				style={[styles.submit, busy && styles.dimmed]}
			>
				<AppText style={styles.submitText}>
					{busy ? "Submitting…" : "Submit score"}
				</AppText>
			</Pressable>
		</Card>
	);
}

const styles = StyleSheet.create({
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
		fontSize: 15,
	},
	submit: {
		height: 48,
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	submitText: { fontSize: 14, fontWeight: "800", color: colors.onAccent },
	dimmed: { opacity: 0.5 },
});
