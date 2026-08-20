/**
 * PROTOTYPE — #46, variant A: "Home base".
 *
 * The argument: V1 has one real screen, and a tab bar is a promise of
 * destinations. Three tabs where two are stubs reads as an unfinished app;
 * no tab bar at all reads as a small, finished one. So: a single stack over a
 * home screen that is mostly one button, with everything else pushed.
 *
 * Resume is a **banner**, not a redirect — the same shape the web already uses
 * (`ActiveSessionBar`). You land on home, you see the workout is still open,
 * you choose. It costs one tap and never traps you in a session you meant to
 * abandon.
 *
 * Auth chrome sits in the home header, because home is the only screen every
 * signed-in user reaches.
 */
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { PrimaryButton } from "../ui/button";
import { Screen } from "../ui/screen";
import { AppText } from "../ui/text";
import {
	formatDuration,
	formatSessionDate,
	useShellData,
} from "./use-shell-data";

export function VariantAHome() {
	const router = useRouter();
	const { signOut } = useAuth();
	const { active, recent, exercises } = useShellData();

	return (
		<Screen>
			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header}>
					<View>
						<AppText variant="caption">Workouts</AppText>
						<AppText variant="title">Today</AppText>
					</View>
					<Pressable
						onPress={() => signOut()}
						hitSlop={10}
						style={styles.avatar}
					>
						<AppText variant="label" style={{ color: colors.text }}>
							Sign out
						</AppText>
					</Pressable>
				</View>

				{active ? (
					<Pressable
						style={styles.resumeBanner}
						onPress={() => router.push("/session")}
					>
						<View style={styles.dot} />
						<View style={styles.flex}>
							<AppText variant="body" style={{ color: colors.accent }}>
								Workout in progress
							</AppText>
							<AppText variant="caption">
								{active.name ?? "Free session"} · started{" "}
								{new Date(active.startTime).toLocaleTimeString(undefined, {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</AppText>
						</View>
						<AppText variant="heading" style={{ color: colors.accent }}>
							›
						</AppText>
					</Pressable>
				) : (
					<PrimaryButton
						label="Start workout"
						size="lg"
						onPress={() => router.push("/session")}
						style={styles.cta}
					/>
				)}

				<Pressable
					style={styles.libraryRow}
					onPress={() => router.push("/exercises")}
				>
					<View style={styles.flex}>
						<AppText variant="body">Exercise library</AppText>
						<AppText variant="caption">
							{exercises === undefined ? "…" : `${exercises.length} exercises`}
						</AppText>
					</View>
					<AppText variant="heading" style={{ color: colors.textMuted }}>
						›
					</AppText>
				</Pressable>

				<AppText variant="label" style={styles.sectionLabel}>
					RECENT
				</AppText>

				{recent === undefined ? (
					<AppText variant="caption">Loading…</AppText>
				) : recent.length === 0 ? (
					<View style={styles.empty}>
						<AppText variant="body" style={{ color: colors.textMuted }}>
							No workouts yet.
						</AppText>
						<AppText variant="caption">
							Your first session shows up here.
						</AppText>
					</View>
				) : (
					recent.map((session) => (
						<View key={session._id} style={styles.sessionRow}>
							<View style={styles.flex}>
								<AppText variant="body">
									{session.name ?? "Free session"}
								</AppText>
								<AppText variant="caption">
									{formatSessionDate(session.date)}
									{session.status !== "completed" ? ` · ${session.status}` : ""}
								</AppText>
							</View>
							<AppText variant="caption">
								{formatDuration(session.startTime, session.endTime) ?? "—"}
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
		gap: spacing.md,
	},
	header: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-between",
		paddingTop: spacing.md,
	},
	avatar: {
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.pill,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	cta: { marginTop: spacing.sm },
	flex: { flex: 1 },
	resumeBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		backgroundColor: colors.accentDim,
		borderWidth: 1,
		borderColor: colors.accent,
		borderRadius: radius.lg,
		padding: spacing.md,
		marginTop: spacing.sm,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
	},
	libraryRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		padding: spacing.md,
	},
	sectionLabel: { marginTop: spacing.sm },
	empty: {
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		padding: spacing.lg,
		alignItems: "center",
		gap: spacing.xs,
	},
	sessionRow: {
		flexDirection: "row",
		alignItems: "center",
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
		paddingVertical: spacing.md,
	},
});
