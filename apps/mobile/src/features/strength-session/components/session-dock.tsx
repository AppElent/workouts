/** What floats over the session: the toast, a group's clock, and rest. */
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Pressable,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { GlassSurface } from "../../../ui/glass-surface";
import { AppText } from "../../../ui/text";
import {
	cancelSessionAlert,
	scheduleSessionAlert,
} from "../data/session-notifications";
import { workspaceStore } from "../data/session-workspace";
import { formatClock, formatScore } from "../session-format";
import {
	amrapScore,
	closeGroup,
	runningGroup,
	type SessionPlan,
	type SetGroup,
	startClock,
	stopClock,
} from "../session-plan";
import { useSessionScreen } from "../session-screen-context";
import { useRestState, useRestTimer } from "./rest-timer";

const alertId = (groupId: string) => `amrap:${groupId}`;
/** Ending a session takes every clock's alert with it. */
export function cancelClockAlerts(plan: SessionPlan) {
	for (const id of Object.keys(plan.groups))
		void cancelSessionAlert(alertId(id));
}
/** The one action a group's clock offers right now, with its alert kept in step. */
export function useClockControls(group: SetGroup) {
	const { actions } = useSessionScreen();
	const { locale, t } = useI18n();
	const copy = t.strength.plan.group;
	const rest = t.strength.plan.rest;
	if (group.mode !== "amrap" || group.state === "closed") return [];
	const start = () => {
		const result = startClock(actions.plan(), group.id, Date.now());
		if (!actions.apply(result, { undoable: false })) return;
		const endsAt = result.plan.groups[group.id]?.endsAt;
		if (endsAt)
			void scheduleSessionAlert(
				alertId(group.id),
				(endsAt - Date.now()) / 1000,
				rest.clockNotificationTitle,
				rest.clockNotificationBody,
			);
	};
	const close = {
		label: closeLabel(group, copy, locale),
		onPress: () => {
			actions.set(closeGroup(actions.plan(), group.id));
			void cancelSessionAlert(alertId(group.id));
		},
	};
	if (group.state === "timeup")
		return group.stoppedRemaining
			? [{ label: copy.resume, onPress: start }, close]
			: [close];
	if (group.state !== "idle") return [];
	return [
		{
			label: fmt(copy.start, { minutes: group.capMinutes }),
			onPress: start,
		},
	];
}
function closeLabel(
	group: SetGroup,
	copy: ReturnType<typeof useI18n>["t"]["strength"]["plan"]["group"],
	locale: string,
) {
	const score = amrapScore(group);
	if (score.rounds === 0 && score.sets === 0) return copy.closeEmpty;
	return fmt(copy.close, { score: formatScore(copy, locale, score) });
}

const NOTICE_MS = 6000;
const NOTICE_VOICEOVER_MS = 20000;
function Notice() {
	const { workspace } = useSessionScreen();
	const { notice, key } = workspace;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const large = useWindowDimensions().fontScale >= 1.35;
	const [voiceOver, setVoiceOver] = useState(false);
	useEffect(() => {
		void AccessibilityInfo.isScreenReaderEnabled().then(setVoiceOver);
	}, []);
	useEffect(() => {
		if (!notice) return;
		AccessibilityInfo.announceForAccessibility(notice.text);
		const timer = setTimeout(
			() => workspaceStore.dismissNotice(key, notice.id),
			voiceOver ? NOTICE_VOICEOVER_MS : NOTICE_MS,
		);
		return () => clearTimeout(timer);
	}, [notice, key, voiceOver]);
	if (!notice) return null;
	const actionLabel = notice.undoLabel ?? notice.retryLabel;
	return (
		<GlassSurface
			cornerRadius={radius.contentCard}
			tint={notice.highlight ? colors.accentDim : undefined}
			style={[styles.pill, large && styles.pillLarge]}
		>
			<View
				style={[styles.toast, large && styles.toastLarge]}
				accessibilityLiveRegion="polite"
			>
				<AppText
					variant="row"
					style={[
						!large && styles.toastText,
						notice.highlight && { color: colors.accent },
					]}
				>
					{notice.text}
				</AppText>
				{actionLabel ? (
					<Pressable
						accessibilityRole="button"
						hitSlop={8}
						onPress={() => {
							workspaceStore.dismissNotice(key, notice.id);
							void (notice.undo ?? notice.retry)?.();
						}}
						style={[styles.toastAction, large && styles.toastActionLarge]}
						testID="session-toast-action"
					>
						<AppText variant="control" style={{ color: colors.accent }}>
							{actionLabel}
						</AppText>
					</Pressable>
				) : null}
			</View>
		</GlassSurface>
	);
}
function ClockPill({ group }: { group: SetGroup }) {
	const { actions } = useSessionScreen();
	const copy = useI18n().t.strength.plan;
	const styles = useThemedStyles(createStyles);
	const large = useWindowDimensions().fontScale >= 1.35;
	const [now, setNow] = useState(Date.now);
	const spoken = useRef<number | null>(null);
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(timer);
	}, []);
	const remaining = Math.max(
		0,
		Math.ceil(((group.endsAt ?? now) - now) / 1000),
	);
	useEffect(() => {
		if (spoken.current === remaining) return;
		spoken.current = remaining;
		if (remaining === 30 || remaining === 10)
			AccessibilityInfo.announceForAccessibility(formatClock(remaining));
	}, [remaining]);
	const score = amrapScore(group);
	return (
		<GlassSurface capsule style={[styles.pill, large && styles.pillLarge]}>
			<View style={[styles.bar, large && styles.barLarge]}>
				<AppText
					variant="heading"
					style={styles.time}
					accessibilityLabel={`${formatClock(remaining)}`}
				>
					{formatClock(remaining)}
				</AppText>
				<AppText variant="secondary" style={styles.clockRound}>
					{fmt(copy.group.clockRound, { round: score.rounds + 1 })}
				</AppText>
				<Pressable
					accessibilityRole="button"
					hitSlop={6}
					onPress={() => {
						actions.set(stopClock(actions.plan(), group.id, Date.now()));
						void cancelSessionAlert(alertId(group.id));
					}}
					style={styles.textButton}
				>
					<AppText variant="control">{copy.group.stop}</AppText>
				</Pressable>
			</View>
		</GlassSurface>
	);
}
function RestPill() {
	const state = useRestState();
	const rest = useRestTimer();
	const copy = useI18n().t.strength.plan.rest;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const large = useWindowDimensions().fontScale >= 1.35;
	const controls = (
		<View style={styles.controls}>
			<RestButton
				label="−15"
				spoken={copy.subtract}
				disabled={state.over}
				onPress={() => rest.adjust(-15)}
			/>
			<RestButton
				label="+15"
				spoken={copy.add}
				onPress={() => rest.adjust(15)}
			/>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={copy.stop}
				onPress={rest.stop}
				style={styles.close}
				testID="session-rest-stop"
			>
				<SymbolView
					name="xmark"
					size={15}
					weight="semibold"
					tintColor={colors.textMuted}
				/>
			</Pressable>
		</View>
	);
	return (
		<GlassSurface
			capsule={!large}
			cornerRadius={radius.contentCard}
			tint={state.over ? colors.accentDim : undefined}
			style={[styles.pill, large && styles.pillLarge]}
		>
			<View style={[styles.bar, large && styles.barLarge]}>
				<AppText
					variant="heading"
					style={[styles.time, state.over && { color: colors.accent }]}
					accessibilityElementsHidden
					importantForAccessibility="no"
				>
					{state.over
						? copy.over
						: `${copy.label} ${formatClock(state.remaining)}`}
				</AppText>
				{controls}
			</View>
		</GlassSurface>
	);
}
function RestButton({
	label,
	spoken,
	disabled,
	onPress,
}: {
	label: string;
	spoken: string;
	disabled?: boolean;
	onPress: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={spoken}
			accessibilityState={{ disabled: Boolean(disabled) }}
			disabled={disabled}
			onPress={onPress}
			style={styles.textButton}
		>
			<AppText
				variant="control"
				style={{ color: disabled ? colors.textFaint : colors.text }}
			>
				{label}
			</AppText>
		</Pressable>
	);
}
export function SessionDock({
	onHeight,
	bottomGap = 0,
}: {
	onHeight: (height: number) => void;
	bottomGap?: number;
}) {
	const { plan } = useSessionScreen();
	const state = useRestState();
	const insets = useSafeAreaInsets();
	const styles = useThemedStyles(createStyles);
	const running = runningGroup(plan);
	const wasRunning = useRef(new Set<string>());
	// A clock reaching zero with the app open gets the haptic the alert would.
	useEffect(() => {
		for (const group of Object.values(plan.groups)) {
			if (group.state === "running") wasRunning.current.add(group.id);
			else if (group.state === "timeup" && wasRunning.current.delete(group.id))
				haptics.sessionWarning();
		}
	}, [plan.groups]);
	return (
		<View
			pointerEvents="box-none"
			onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
			style={[
				styles.dock,
				{ paddingBottom: Math.max(insets.bottom, spacing.sm) + bottomGap },
			]}
		>
			<Notice />
			{running ? <ClockPill group={running} /> : null}
			{state.running ? <RestPill /> : null}
		</View>
	);
}
const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		dock: {
			position: "absolute",
			left: spacing.md,
			right: spacing.md,
			bottom: 0,
			gap: spacing.xs,
		},
		pill: {
			minHeight: 56,
			justifyContent: "center",
			borderRadius: radius.pill,
			overflow: "hidden",
		},
		pillLarge: { borderRadius: radius.contentCard },
		toast: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.sm,
		},
		toastLarge: { flexDirection: "column", alignItems: "stretch", gap: 0 },
		toastText: { flex: 1, minWidth: 0 },
		toastAction: { minHeight: 44, justifyContent: "center" },
		toastActionLarge: { alignSelf: "flex-end" },
		bar: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			flexWrap: "wrap",
			gap: spacing.xs,
			paddingLeft: spacing.md,
			paddingRight: spacing.xs,
			minHeight: 56,
		},
		barLarge: { paddingVertical: spacing.sm },
		time: { fontVariant: ["tabular-nums"], flexShrink: 0 },
		clockRound: { color: colors.textMuted, flex: 1, marginLeft: spacing.xs },
		controls: { flexDirection: "row", alignItems: "center", gap: 2 },
		textButton: {
			minWidth: 48,
			minHeight: 44,
			alignItems: "center",
			justifyContent: "center",
			paddingHorizontal: spacing.xs,
		},
		close: {
			width: 44,
			height: 44,
			alignItems: "center",
			justifyContent: "center",
		},
	});
