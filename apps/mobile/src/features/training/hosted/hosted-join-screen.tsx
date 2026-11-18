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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { PrimaryButton } from "../../../ui/button";
import { AppText } from "../../../ui/text";
import { useWriteFailureMessage } from "../../../ui/use-screen-write";
import { parseJoinInput } from "./join-link";
import { clearPendingJoin } from "./pending-join";

export function HostedJoinScreen() {
	const colors = useTokens();
	const router = useRouter();
	const copy = useI18n().t.hosted;
	const errorMessage = useWriteFailureMessage();
	const join = useMutation(api.hostedWorkoutParticipants.join);
	const params = useLocalSearchParams<{ token?: string }>();
	const token = parseJoinInput(params.token ?? "");
	const [failure, setFailure] = useState<string | null>(null);
	const started = useRef<string | null>(null);

	useEffect(() => {
		clearPendingJoin();
		if (!token) {
			setFailure(copy.joinLinkInvalid);
			return;
		}
		// One join per token, even when the effect runs again.
		if (started.current === token) return;
		started.current = token;
		setFailure(null);
		join({ token })
			.then((sessionId) =>
				router.replace({ pathname: "/session", params: { id: sessionId } }),
			)
			.catch((error: unknown) =>
				setFailure(errorMessage(error, copy.joinLinkInvalid)),
			);
	}, [token, join, router, errorMessage, copy.joinLinkInvalid]);

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
