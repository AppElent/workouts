import { formatClock } from "@foundry/core";
/** Resume control, laid out by the native tab accessory or its inline fallback. */
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useActiveSession } from "../../../data/session-data";
import { fmt, useI18n } from "../../../i18n";
import {
	opacity,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
} from "../../../theme";
import { isIOS26OrLater } from "../../../ui/platform";
import { AppText } from "../../../ui/text";
import { useRestState } from "../data/rest-timer";

export function ActiveSessionBar() {
	const styles = useThemedStyles(createStyles);
	const { t } = useI18n();
	const copy = t.workoutTools.activeSession;
	const resume = t.strength.plan.resume;
	const rest = useRestState();
	const router = useRouter();
	const active = useActiveSession();

	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [active]);

	if (!active) return null;

	return (
		<View style={styles.wrap} pointerEvents="box-none">
			<Pressable
				onPress={() => router.push("/session")}
				style={({ pressed }) => [
					styles.bar,
					pressed && { opacity: opacity.pressed },
				]}
				accessibilityRole="button"
				accessibilityLabel={fmt(resume.label, {
					name: active.name ?? copy.freeSession,
				})}
			>
				<View style={styles.dot} />
				<View style={styles.flex}>
					<AppText variant="caption" style={styles.label}>
						{copy.inProgress}
					</AppText>
					<AppText variant="body" style={styles.name} numberOfLines={1}>
						{active.name ?? copy.freeSession}
					</AppText>
				</View>
				<AppText variant="body" style={styles.elapsed}>
					{rest.running
						? fmt(rest.over ? resume.lineRestOver : resume.lineRest, {
								time: formatClock((now - active.startTime) / 1000),
								rest: formatClock(rest.remaining),
							})
						: formatClock((now - active.startTime) / 1000)}
				</AppText>
				<AppText variant="body" style={styles.resume}>
					{copy.resume}
				</AppText>
			</Pressable>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		wrap: {
			paddingHorizontal: isIOS26OrLater() ? spacing.xs : spacing.md,
		},
		bar: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			minHeight: 44,
			paddingHorizontal: spacing.md,
			borderRadius: radius.pill,
			// The native tab accessory already draws the glass capsule.
			backgroundColor: isIOS26OrLater() ? "transparent" : colors.surface2,
		},
		dot: {
			width: 8,
			height: 8,
			borderRadius: radius.pill,
			backgroundColor: colors.accentFill,
		},
		flex: { flex: 1 },
		label: {
			color: colors.accent,
			letterSpacing: 1,
			textTransform: "uppercase",
		},
		name: { fontWeight: "700" },
		elapsed: {
			color: colors.textMuted,
			fontWeight: "700",
			fontVariant: ["tabular-nums"],
		},
		resume: { color: colors.accent, fontWeight: "800" },
	});
