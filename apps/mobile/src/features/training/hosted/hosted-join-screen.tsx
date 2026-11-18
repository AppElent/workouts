/**
 * Where a hosted-workout join link lands (`/join/<token>`, see
 * `app/+native-intent.tsx`). It joins as the signed-in user straight away and
 * replaces itself with the workout session, exactly as the Hosted screen's
 * code box does; joining twice returns the session you already have.
 *
 * Signed out, the `(app)` guard sends the user to sign-in first and remembers
 * the token (`pending-join.ts`), so the link still joins afterwards.
 *
 * The session, not `hosted/[id]`: that screen is the host's console and shows
 * "not found" to everyone else.
 */
import { useMutation } from "convex/react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { PrimaryButton } from "../../../ui/button";
import { AppText } from "../../../ui/text";
import { useWriteFailureMessage } from "../../../ui/use-screen-write";
import { isJoinToken } from "./join-link";
import { clearPendingJoin } from "./pending-join";

export function HostedJoinScreen() {
	const colors = useTokens();
	const router = useRouter();
	const copy = useI18n().t.hosted;
	const errorMessage = useWriteFailureMessage();
	const join = useMutation(api.hostedWorkoutParticipants.join);
	const params = useLocalSearchParams<{ token?: string }>();
	// The segment must be the token itself, never a link or path inside it.
	const token = isJoinToken(params.token ?? "") ? (params.token ?? "") : null;
	const [failure, setFailure] = useState<string | null>(null);

	useFocusEffect(
		useCallback(() => {
			clearPendingJoin();
			if (!token) {
				setFailure(copy.joinLinkInvalid);
				return;
			}
			// A join that finishes after the screen lost focus (left, covered by a
			// pushed screen, or replaced by another link) must not navigate. Joining
			// again on refocus is safe: the mutation returns the existing session.
			let current = true;
			setFailure(null);
			join({ token })
				.then((sessionId) => {
					if (current) {
						router.replace({ pathname: "/session", params: { id: sessionId } });
					}
				})
				.catch((error: unknown) => {
					if (current) setFailure(errorMessage(error, copy.joinLinkInvalid));
				});
			return () => {
				current = false;
			};
		}, [token, join, router, errorMessage, copy.joinLinkInvalid]),
	);

	return (
		<View style={[styles.root, { backgroundColor: colors.bg }]}>
			{failure === null ? (
				<>
					<ActivityIndicator color={colors.accent} />
					<AppText variant="caption">{copy.joining}</AppText>
				</>
			) : (
				<>
					<AppText variant="heading" style={styles.centered}>
						{copy.joinError}
					</AppText>
					<AppText variant="caption" style={styles.centered}>
						{failure}
					</AppText>
					<PrimaryButton
						label={copy.joinWithCode}
						onPress={() => router.replace("/hosted")}
						style={styles.action}
					/>
				</>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.sm,
		paddingHorizontal: spacing.lg,
	},
	centered: { textAlign: "center" },
	action: { marginTop: spacing.md, alignSelf: "stretch" },
});
