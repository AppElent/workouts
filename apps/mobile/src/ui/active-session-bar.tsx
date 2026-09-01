/**
 * The "you left a workout running" bar, ported from the web's
 * `src/components/ActiveSessionBar.tsx`.
 *
 * It hides itself on the session screen, for the same reason the web version
 * does: a bar offering to resume the thing you are already looking at is noise,
 * and it would sit on top of the log button.
 *
 * Mounted in `app/(app)/_layout.tsx` so it floats over both the tab group and
 * anything pushed on top of it. The `pointerEvents="box-none"` on the wrapper
 * is load-bearing — an absolutely-positioned overlay without it swallows every
 * touch on Android, including the tab bar underneath.
 */
import { useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveSession } from "../data/session-data";
import { colors, radius, spacing } from "../theme";
import { AppText } from "./text";

/** Height of the native tab bar, so the bar sits above it rather than under. */
const TAB_BAR_ALLOWANCE = 64;

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
	const router = useRouter();
	const segments = useSegments();
	const insets = useSafeAreaInsets();
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
		<View
			style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_ALLOWANCE }]}
			pointerEvents="box-none"
		>
			<Pressable
				onPress={() => router.push("/session")}
				style={({ pressed }) => [styles.bar, pressed && { opacity: 0.9 }]}
				accessibilityRole="button"
				accessibilityLabel="Resume active workout"
			>
				<View style={styles.dot} />
				<View style={styles.flex}>
					<AppText variant="caption" style={styles.label}>
						In progress
					</AppText>
					<AppText variant="body" style={styles.name} numberOfLines={1}>
						{active.name ?? "Free session"}
					</AppText>
				</View>
				<AppText variant="body" style={styles.elapsed}>
					{formatElapsed(now - active.startTime)}
				</AppText>
				<AppText variant="body" style={styles.resume}>
					Resume
				</AppText>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: "absolute",
		left: spacing.md,
		right: spacing.md,
		zIndex: 50,
	},
	bar: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		minHeight: 56,
		paddingHorizontal: spacing.md,
		borderRadius: radius.pill,
		backgroundColor: colors.surface2,
		borderWidth: 1,
		borderColor: colors.accent,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
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
