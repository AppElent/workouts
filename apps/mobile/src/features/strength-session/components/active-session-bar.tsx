/** Resume control, laid out by the native tab accessory or its inline fallback. */
import { useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useActiveSession } from "../../../data/session-data";
import { useI18n } from "../../../i18n";
import { radius, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { AppText } from "../../../ui/text";

/** "0:42" under an hour, "1:02:47" over it. */
function formatElapsed(ms: number) {
	const total = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	const pad = (n: number) => n.toString().padStart(2, "0");
	return hours > 0
		? `${hours}:${pad(minutes)}:${pad(seconds)}`
		: `${minutes}:${pad(seconds)}`;
}

export function ActiveSessionBar() {
	const styles = useThemedStyles(createStyles);
	const copy = useI18n().t.workoutTools.activeSession;
	const router = useRouter();
	const segments = useSegments();
	const active = useActiveSession();

	const onSessionScreen = segments.includes("session" as never);

	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active || onSessionScreen) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [active, onSessionScreen]);

	if (!active || onSessionScreen) return null;

	return (
		<View style={styles.wrap} pointerEvents="box-none">
			<Pressable
				onPress={() => router.push("/session")}
				style={({ pressed }) => [styles.bar, pressed && { opacity: 0.9 }]}
				accessibilityRole="button"
				accessibilityLabel={copy.resumeLabel}
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
					{formatElapsed(now - active.startTime)}
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
			paddingHorizontal: spacing.md,
		},
		bar: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			minHeight: 44,
			paddingHorizontal: spacing.md,
			borderRadius: radius.pill,
			backgroundColor: colors.surface2,
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
