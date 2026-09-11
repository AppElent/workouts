/**
 * Hosted workouts — the list you host, and the box to join someone else's.
 * Ported from the web's `src/routes/hosted-workouts/index.tsx` and
 * `src/components/hosted/JoinHostedWorkout.tsx`.
 *
 * Two deliberate omissions from the web's version, both scoping rather than
 * oversight:
 *
 * 1. **No builder.** Creating a hosted workout means naming strength blocks and
 *    giving every WOD four scaling levels (Rx/L1/L2/L3 — the backend rejects a
 *    template missing any). That is a planning task done at a desk before a
 *    class, and it is a genuinely bad phone form. Hosts create on the web; the
 *    phone opens, closes, watches the leaderboard, and takes part.
 *
 * 2. **No guest path.** The web's join link lets anyone submit a score without
 *    an account (`submitGuest`, reachable from a QR code). That has no sensible
 *    native equivalent — the app is Clerk-gated before this screen renders — so
 *    the phone joins as a signed-in participant only.
 */
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { api, type Doc } from "../convex/api";
import { formatSessionDate } from "../data/session-data";
import { colors, radius, spacing } from "../theme";
import { Chip, Eyebrow } from "../ui/coach";
import { convexErrorMessage } from "../ui/confirm-dialog";
import { Screen } from "../ui/screen";
import { ScreenHeader } from "../ui/screen-header";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

const STATUS_LABEL: Record<Doc<"hostedWorkouts">["status"], string> = {
	draft: "Draft",
	open: "Open",
	closed: "Closed",
};

export function HostedListScreen() {
	const router = useRouter();
	const toast = useToast();
	const hosted = useQuery(api.hostedWorkouts.listMine, {});
	const join = useMutation(api.hostedWorkoutParticipants.join);

	const [token, setToken] = useState("");
	const [busy, setBusy] = useState(false);

	const submitJoin = async () => {
		const trimmed = token.trim();
		if (trimmed === "" || busy) return;
		setBusy(true);
		try {
			// Returns the session it created (or the one you already had), so
			// joining lands straight in the workout rather than on a confirmation.
			const sessionId = await join({ token: trimmed });
			setToken("");
			router.push({ pathname: "/session", params: { id: sessionId } });
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not join that workout."));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Screen edges={["bottom"]}>
			<ScreenHeader title={"Hosted workouts"} />

			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				automaticallyAdjustKeyboardInsets
				keyboardDismissMode="interactive"
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<Eyebrow>Join with a code</Eyebrow>
				<View style={styles.joinRow}>
					<TextInput
						value={token}
						onChangeText={setToken}
						placeholder="Join code"
						placeholderTextColor={colors.textFaint}
						style={[styles.input, styles.flex]}
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="go"
						onSubmitEditing={() => void submitJoin()}
					/>
					<Pressable
						onPress={() => void submitJoin()}
						disabled={busy || token.trim() === ""}
						style={[
							styles.joinBtn,
							(busy || token.trim() === "") && styles.dimmed,
						]}
					>
						<AppText style={styles.joinBtnText}>
							{busy ? "Joining…" : "Join"}
						</AppText>
					</Pressable>
				</View>
				<AppText variant="caption">
					Joining starts a session for you. Finish or cancel any workout you
					already have running first.
				</AppText>

				<Eyebrow>Hosting</Eyebrow>
				{hosted === undefined ? (
					<AppText style={styles.muted}>Loading…</AppText>
				) : hosted.length === 0 ? (
					<View style={styles.empty}>
						<AppText variant="heading" style={{ color: colors.textMuted }}>
							Not hosting anything
						</AppText>
						<AppText variant="caption" style={styles.centered}>
							Build a hosted workout on the web app — then open, run and score
							it from here.
						</AppText>
					</View>
				) : (
					<View style={styles.list}>
						{hosted.map((h) => (
							<Pressable
								key={h._id}
								onPress={() =>
									router.push({
										pathname: "/hosted/[id]",
										params: { id: h._id },
									})
								}
								style={({ pressed }) => [
									styles.row,
									pressed && { backgroundColor: colors.surface2 },
								]}
							>
								<View style={styles.flex}>
									<AppText variant="body" style={styles.rowTitle}>
										{h.title}
									</AppText>
									<AppText variant="caption">
										{h.scheduledAt
											? formatSessionDate(h.scheduledAt)
											: formatSessionDate(h.createdAt)}
									</AppText>
								</View>
								<Chip
									label={STATUS_LABEL[h.status]}
									active={h.status === "open"}
								/>
								<AppText style={styles.chevron}>›</AppText>
							</Pressable>
						))}
					</View>
				)}
			</ScrollView>
		</Screen>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingHorizontal: spacing.md,
		paddingTop: spacing.md,
		paddingBottom: spacing.sm,
	},
	content: {
		paddingHorizontal: spacing.md,
		paddingBottom: spacing.xxl * 2,
		gap: spacing.sm,
	},
	joinRow: { flexDirection: "row", gap: spacing.sm },
	flex: { flex: 1, gap: 2 },
	input: {
		minHeight: 48,
		borderRadius: radius.lg,
		paddingHorizontal: spacing.md,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		color: colors.text,
		fontSize: 15,
	},
	joinBtn: {
		minHeight: 48,
		paddingHorizontal: spacing.lg,
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	joinBtnText: { fontSize: 14, fontWeight: "800", color: colors.onAccent },
	dimmed: { opacity: 0.5 },
	muted: { fontSize: 13, color: colors.textMuted },
	centered: { textAlign: "center" },
	empty: {
		alignItems: "center",
		gap: 4,
		paddingVertical: spacing.lg,
		paddingHorizontal: spacing.md,
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
	},
	list: { gap: spacing.sm },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		padding: spacing.md,
	},
	rowTitle: { fontWeight: "700" },
	chevron: { fontSize: 18, color: colors.textFaint },
});
