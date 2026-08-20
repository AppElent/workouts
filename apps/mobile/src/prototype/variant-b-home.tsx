/**
 * PROTOTYPE — #46, variant B: "Tabs with a verb".
 *
 * gather's ADR-0018 applied literally: mobile tabs are app destinations and one
 * of them is a verb. Home and Exercises are places; Start is an action wearing
 * a tab's clothes — a `disabled` trigger, which renders in the bar and emits
 * `tabPress` but never navigates, so the bar intercepts and pushes a session
 * instead of switching tabs.
 *
 * The bet this variant makes about decision 2: ship **two** real destinations
 * and no stubs. Dashboard, progress and routines stay off the bar entirely
 * rather than appearing as empty rooms. A tab bar with a stub in it is a
 * promise the app can't keep; a two-tab bar is just a small app.
 *
 * Home is denser here than in A, because a tab bar implies there is somewhere
 * to come back *to* — a home that's one button doesn't earn a permanent tab.
 * Resume is a redirect (see the layout), and this banner is the trail back.
 */
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { Screen } from "../ui/screen";
import { AppText } from "../ui/text";
import { useResumeRedirect } from "./use-resume-redirect";
import {
	formatDuration,
	formatSessionDate,
	useShellData,
} from "./use-shell-data";

export function VariantBHome() {
	const router = useRouter();
	const { signOut } = useAuth();
	const { active, recent } = useShellData();
	useResumeRedirect();

	const completed = recent?.filter((s) => s.status === "completed") ?? [];
	const thisWeek = completed.filter(
		(s) => Date.now() - s.date < 7 * 24 * 60 * 60 * 1000,
	).length;

	return (
		<Screen edges={["top"]}>
			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header}>
					<AppText variant="title">Home</AppText>
					<Pressable onPress={() => signOut()} hitSlop={10}>
						<AppText variant="label">Sign out</AppText>
					</Pressable>
				</View>

				{active ? (
					<Pressable
						style={styles.resume}
						onPress={() => router.push("/session")}
					>
						<View style={styles.dot} />
						<AppText variant="body" style={{ color: colors.accent, flex: 1 }}>
							Resume workout
						</AppText>
						<AppText variant="heading" style={{ color: colors.accent }}>
							›
						</AppText>
					</Pressable>
				) : null}

				<View style={styles.statRow}>
					<View style={styles.statCard}>
						<AppText variant="metric">{thisWeek}</AppText>
						<AppText variant="caption">workouts this week</AppText>
					</View>
					<View style={styles.statCard}>
						<AppText variant="metric">{completed.length}</AppText>
						<AppText variant="caption">recent sessions</AppText>
					</View>
				</View>

				<AppText variant="label" style={styles.sectionLabel}>
					HISTORY
				</AppText>

				{recent === undefined ? (
					<AppText variant="caption">Loading…</AppText>
				) : recent.length === 0 ? (
					<View style={styles.empty}>
						<AppText variant="body" style={{ color: colors.textMuted }}>
							Nothing logged yet
						</AppText>
						<AppText variant="caption">
							Tap Start below to begin your first workout.
						</AppText>
					</View>
				) : (
					recent.map((session) => (
						<View key={session._id} style={styles.card}>
							<View style={styles.flex}>
								<AppText variant="body">
									{session.name ?? "Free session"}
								</AppText>
								<AppText variant="caption">
									{formatSessionDate(session.date)}
								</AppText>
							</View>
							<AppText variant="caption">
								{formatDuration(session.startTime, session.endTime) ??
									session.status}
							</AppText>
						</View>
					))
				)}
			</ScrollView>
		</Screen>
	);
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: spacing.md,
		paddingBottom: spacing.xxl * 2,
		gap: spacing.sm,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingTop: spacing.md,
		marginBottom: spacing.sm,
	},
	flex: { flex: 1 },
	resume: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		backgroundColor: colors.accentDim,
		borderWidth: 1,
		borderColor: colors.accent,
		borderRadius: radius.lg,
		padding: spacing.md,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
	},
	statRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
	statCard: {
		flex: 1,
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		padding: spacing.md,
		gap: spacing.xs,
	},
	sectionLabel: { marginTop: spacing.md },
	empty: {
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		padding: spacing.lg,
		alignItems: "center",
		gap: spacing.xs,
	},
	card: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		padding: spacing.md,
	},
});
