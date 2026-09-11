/**
 * Ported from the web's `src/components/OfflineBanner.tsx`.
 *
 * Convex queues mutations while the socket is down and replays them on
 * reconnect, so the app stays usable offline — but a set that hasn't reached
 * the server yet looks identical to one that has. This banner is the only thing
 * telling the difference, which matters most in exactly the place a phone loses
 * signal: a basement gym.
 *
 * No dismiss button, deliberately. It disappears when the condition does.
 *
 * The sentence comes from the message tree: this banner floats over every
 * screen including the Nutrition ones, and an English strip across a Dutch app
 * is exactly the kind of gap #79 exists to close.
 */
import { useConvexConnectionState } from "convex/react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../i18n";
import { colors, spacing } from "../theme";
import { AppText } from "./text";

export function OfflineBanner() {
	const { isWebSocketConnected } = useConvexConnectionState();
	const insets = useSafeAreaInsets();
	const { t } = useI18n();

	if (isWebSocketConnected) return null;

	return (
		<View
			style={[styles.wrap, { paddingTop: insets.top + spacing.xs }]}
			pointerEvents="none"
		>
			<AppText variant="caption" style={styles.text}>
				{t.common.offline}
			</AppText>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		alignItems: "center",
		paddingBottom: spacing.xs,
		paddingHorizontal: spacing.md,
		backgroundColor: "rgba(251, 191, 36, 0.12)",
		borderBottomWidth: 1,
		borderBottomColor: "rgba(251, 191, 36, 0.25)",
	},
	text: { color: colors.warn, fontWeight: "600" },
});
