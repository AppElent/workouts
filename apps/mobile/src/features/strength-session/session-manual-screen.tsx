import { SET_LIMITS, validateManualOneRepMax } from "@foundry/core";
/** Enter or change a manual 1RM for one exercise. It applies to this session at once. */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";
import type { Id } from "../../convex/api";
import { fmt, parseLocalizedDecimal, useI18n } from "../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	type,
	useThemedStyles,
	useTokens,
} from "../../theme";
import { AppText } from "../../ui/text";
import { useSessionActions } from "./data/session-actions";
import { useSessionWorkspace } from "./data/session-workspace";
import { formatNumber } from "./session-format";
import {
	bestKnown,
	manualIsOdd,
	referenceFor,
	setManual,
} from "./session-plan";
import { useKeyboardHeight } from "./use-keyboard-height";

export function SessionManualScreen() {
	const params = useLocalSearchParams<{
		sessionId: Id<"workoutSessions">;
		exerciseId: string;
	}>();
	const workspace = useSessionWorkspace(params.sessionId);
	const actions = useSessionActions(workspace);
	const { plan, getFacts, nameOf } = workspace;
	const router = useRouter();
	const { locale, t } = useI18n();
	const text = t.strength.plan.editor;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const facts = getFacts(params.exerciseId);
	const current = plan ? referenceFor(plan, facts, params.exerciseId) : null;
	const [value, setValue] = useState(
		current?.source === "manual" ? String(current.value) : "",
	);
	const [confirmed, setConfirmed] = useState<number | null>(null);
	const keyboard = useKeyboardHeight();
	const parsed = parseLocalizedDecimal(value) ?? Number.NaN;
	const inRange = value.trim() !== "" && validateManualOneRepMax(parsed).ok;
	const odd = Boolean(
		plan && inRange && manualIsOdd(plan, params.exerciseId, parsed, facts),
	);
	const needsConfirm = odd && confirmed !== parsed;
	const known = plan ? bestKnown(plan, params.exerciseId, facts) : null;
	const top = Math.max(known?.measured ?? 0, known?.estimated ?? 0);
	const close = () => {
		if (router.canGoBack()) router.back();
	};
	function save() {
		if (!inRange || !plan) return;
		if (needsConfirm) {
			setConfirmed(parsed);
			return;
		}
		actions.apply(setManual(actions.plan(), params.exerciseId, parsed, facts));
		Keyboard.dismiss();
		close();
	}
	const label = !inRange
		? value.trim() === ""
			? text.manualSave
			: fmt(text.manualMax, { max: SET_LIMITS.manualOneRepMax.max })
		: odd && confirmed !== parsed
			? fmt(text.manualConfirm, { value: formatNumber(parsed, locale) })
			: text.manualSave;
	return (
		<View style={[styles.screen, { paddingBottom: keyboard + spacing.md }]}>
			<View style={styles.body}>
				<AppText
					accessibilityRole="header"
					variant="heading"
					style={styles.title}
				>
					{fmt(text.manualTitle, { name: nameOf(params.exerciseId) })}
				</AppText>
				<AppText variant="secondary" style={{ color: colors.textMuted }}>
					{text.manualSub}
				</AppText>
				<AppText variant="label" style={{ color: colors.textMuted }}>
					{text.manualField}
				</AppText>
				<TextInput
					autoFocus
					accessibilityLabel={text.manualField}
					value={value}
					onChangeText={setValue}
					keyboardType="decimal-pad"
					selectTextOnFocus
					placeholder="—"
					placeholderTextColor={colors.textFaint}
					style={styles.field}
					testID="session-manual-field"
				/>
				{odd ? (
					<AppText variant="secondary" style={{ color: colors.warn }}>
						{fmt(text.manualOdd, {
							top: formatNumber(Math.round(top), locale),
						})}
					</AppText>
				) : null}
			</View>
			<Pressable
				accessibilityRole="button"
				accessibilityState={{ disabled: !inRange }}
				disabled={!inRange}
				onPress={save}
				style={[styles.primary, !inRange && styles.primaryOff]}
				testID="session-manual-save"
			>
				<AppText
					variant="control"
					style={{
						color: inRange ? colors.onAccent : colors.textMuted,
						fontWeight: "700",
					}}
				>
					{label}
				</AppText>
			</Pressable>
		</View>
	);
}
const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		screen: {
			flex: 1,
			backgroundColor: colors.bg,
			paddingHorizontal: spacing.md,
			justifyContent: "space-between",
		},
		body: { gap: spacing.sm, paddingTop: spacing.xl },
		title: { textAlign: "center", marginBottom: spacing.sm },
		field: {
			minHeight: 72,
			textAlign: "center",
			color: colors.text,
			backgroundColor: colors.surface2,
			borderRadius: radius.lg,
			...type.quantityCompact,
			padding: 0,
		},
		primary: {
			minHeight: 56,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.pill,
			backgroundColor: colors.accentFill,
		},
		primaryOff: { backgroundColor: colors.surface2 },
	});
