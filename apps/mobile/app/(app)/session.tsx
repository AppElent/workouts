/**
 * The log-workout screen — a placeholder, deliberately. #47 fills it in; this
 * ticket only has to prove the shell can *get here* and that the way back out
 * makes sense in each variant.
 *
 * It still shows the real active session when there is one, because "what does
 * a resumed workout look like the instant you land on it" is a shell question
 * even when the screen under it is empty.
 */
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useShellData } from "../../src/prototype/use-shell-data";
import { colors, radius, spacing } from "../../src/theme";
import { GhostButton } from "../../src/ui/button";
import { Screen } from "../../src/ui/screen";
import { AppText } from "../../src/ui/text";

export default function Session() {
	const router = useRouter();
	const { active } = useShellData();

	return (
		<Screen>
			<View style={styles.root}>
				<View style={styles.header}>
					<Pressable onPress={() => router.back()} hitSlop={12}>
						<AppText variant="heading" style={{ color: colors.accent }}>
							‹
						</AppText>
					</Pressable>
					<View style={styles.flex}>
						<AppText variant="caption">
							{active ? "In progress" : "Not started"}
						</AppText>
						<AppText variant="heading">
							{active?.name ?? "Free session"}
						</AppText>
					</View>
				</View>

				<View style={styles.placeholder}>
					<AppText variant="heading" style={{ color: colors.textMuted }}>
						Log workout
					</AppText>
					<AppText variant="caption" style={styles.centered}>
						Add exercise, log sets, finish. Built in #47 — this ticket only had
						to get you here.
					</AppText>
				</View>

				<GhostButton label="Back" onPress={() => router.back()} />
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: spacing.md, gap: spacing.md },
	header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	flex: { flex: 1 },
	placeholder: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.sm,
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		borderWidth: 1,
		borderColor: colors.border,
		borderStyle: "dashed",
		padding: spacing.lg,
	},
	centered: { textAlign: "center" },
});
