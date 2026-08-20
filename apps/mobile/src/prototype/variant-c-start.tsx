/**
 * PROTOTYPE — #46, variant C: "Session first".
 *
 * The argument from where the phone is actually used: standing in a gym,
 * one-handed, between sets, possibly with a barbell still in the other hand.
 * Under those conditions a home screen is a toll booth. So the app's front door
 * *is* the action — one target that fills the screen, no bar, no list, and
 * everything else demoted to small header affordances.
 *
 * Resume is a **hard redirect** (see the layout): if a workout is open, the
 * front door is that workout. You cannot land anywhere else, because there is
 * nothing else you meant to do.
 *
 * The cost, and the reason this needs judging in the hand rather than on
 * paper: history becomes almost invisible, and an app you only ever see mid-set
 * gives you nothing on the days you don't train.
 */
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { Screen } from "../ui/screen";
import { AppText } from "../ui/text";
import { useResumeRedirect } from "./use-resume-redirect";
import { formatSessionDate, useShellData } from "./use-shell-data";

export function VariantCStart() {
	const router = useRouter();
	const { signOut } = useAuth();
	const { recent } = useShellData();
	useResumeRedirect();
	const last = recent?.find((s) => s.status === "completed");

	return (
		<Screen>
			<View style={styles.root}>
				<View style={styles.chrome}>
					<Pressable onPress={() => router.push("/exercises")} hitSlop={10}>
						<AppText variant="label">Exercises</AppText>
					</Pressable>
					<Pressable onPress={() => signOut()} hitSlop={10}>
						<AppText variant="label">Sign out</AppText>
					</Pressable>
				</View>

				<Pressable
					style={({ pressed }) => [
						styles.target,
						{ backgroundColor: pressed ? colors.accentPressed : colors.accent },
					]}
					onPress={() => router.push("/session")}
				>
					<AppText style={styles.targetLabel}>START</AppText>
					<AppText style={styles.targetSub}>tap to begin</AppText>
				</Pressable>

				<Pressable
					style={styles.footer}
					onPress={() => router.push("/history")}
				>
					{last ? (
						<AppText variant="caption">
							Last workout {formatSessionDate(last.date)} ·{" "}
							{last.name ?? "Free session"}
						</AppText>
					) : (
						<AppText variant="caption">No workouts yet</AppText>
					)}
					<AppText variant="label" style={{ color: colors.accent }}>
						History ›
					</AppText>
				</Pressable>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		paddingHorizontal: spacing.md,
		justifyContent: "space-between",
	},
	chrome: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingTop: spacing.sm,
	},
	target: {
		flex: 1,
		marginVertical: spacing.lg,
		borderRadius: radius.sheet * 2,
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.xs,
	},
	targetLabel: {
		fontSize: 48,
		fontWeight: "900",
		letterSpacing: 4,
		color: colors.onAccent,
	},
	targetSub: {
		fontSize: 13,
		fontWeight: "700",
		color: "rgba(0, 0, 0, 0.55)",
		letterSpacing: 1,
	},
	footer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingBottom: spacing.md,
	},
});
