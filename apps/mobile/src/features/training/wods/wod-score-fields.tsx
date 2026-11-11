/**
 * The score inputs for one WOD type — a time for For Time, rounds-plus-reps
 * for AMRAP, reps for EMOM, a load for Load — shared by the personal WOD log
 * and the hosted-workout score box.
 */
import {
	buildWodScore,
	parseClockInput,
	validateWodScore,
	type WodType,
} from "@foundry/core";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { parseLocalizedDecimal, useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	type,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Chip } from "../../../ui/coach";

const EMPTY = { time: "", rounds: "", reps: "", load: "", notes: "" };
type ScoreText = typeof EMPTY;

export function useWodScoreDraft(wodType: WodType) {
	const [text, setText] = useState<ScoreText>(EMPTY);
	const [capped, setCapped] = useState(false);
	const score = buildWodScore(wodType, {
		timeSeconds: parseClockInput(text.time),
		timeCapped: capped,
		rounds: parseLocalizedDecimal(text.rounds),
		reps: parseLocalizedDecimal(text.reps),
		load: parseLocalizedDecimal(text.load),
		loadUnit: "kg",
	});
	const notes = text.notes.trim();
	return {
		wodType,
		text,
		set: (field: keyof ScoreText, value: string) =>
			setText((current) => ({ ...current, [field]: value })),
		capped,
		setCapped,
		score,
		notes: notes === "" ? undefined : notes,
		complete: validateWodScore(wodType, score).ok,
		reset: () => {
			setText(EMPTY);
			setCapped(false);
		},
	};
}

export type WodScoreDraft = ReturnType<typeof useWodScoreDraft>;

export function WodScoreFields({
	draft,
	inCard = false,
}: {
	draft: WodScoreDraft;
	/** Inputs on a card sit one surface higher than on the screen. */
	inCard?: boolean;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const copy = useI18n().t.wods.score;
	const { text, set } = draft;
	const input = [styles.input, inCard && styles.inputOnCard];
	const field = (
		name: keyof ScoreText,
		placeholder: string,
		keyboardType?: "number-pad" | "decimal-pad",
		grow = false,
	) => (
		<TextInput
			value={text[name]}
			onChangeText={(value) => set(name, value)}
			placeholder={placeholder}
			placeholderTextColor={colors.textFaint}
			style={[input, grow && styles.flex]}
			keyboardType={keyboardType}
		/>
	);

	return (
		<>
			{draft.wodType === "forTime" ? (
				<>
					<View style={styles.selfStart}>
						<Chip
							label={copy.hitTimeCap}
							active={draft.capped}
							onPress={() => draft.setCapped(!draft.capped)}
						/>
					</View>
					{draft.capped
						? field("reps", copy.repsAtCap, "number-pad")
						: field("time", copy.time)}
				</>
			) : null}

			{draft.wodType === "amrap" ? (
				<View style={styles.formRow}>
					{field("rounds", copy.rounds, "number-pad", true)}
					{field("reps", copy.plusReps, "number-pad", true)}
				</View>
			) : null}

			{draft.wodType === "emom"
				? field("reps", copy.totalReps, "number-pad")
				: null}

			{draft.wodType === "load"
				? field("load", copy.load, "decimal-pad")
				: null}

			{field("notes", copy.notes)}
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		selfStart: { alignSelf: "flex-start" },
		formRow: { flexDirection: "row", gap: spacing.sm },
		flex: { flex: 1 },
		input: {
			minHeight: 48,
			borderRadius: radius.lg,
			paddingHorizontal: spacing.md,
			backgroundColor: colors.surface,
			borderWidth: 1,
			borderColor: colors.border,
			color: colors.text,
			fontSize: type.body.fontSize,
		},
		inputOnCard: { backgroundColor: colors.surface2 },
	});
