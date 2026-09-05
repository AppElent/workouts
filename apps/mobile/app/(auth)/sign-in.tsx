/**
 * Email and password — the whole signed-out surface. No sign-up, no reset, no
 * OAuth: #41 scopes V1 to an app you sign into with an account you already
 * have, and every one of those is a Clerk flow with its own screens.
 *
 * The submit does not navigate: `finalize()` (in `usePasswordSignIn`) flips
 * `isSignedIn`, the `(auth)` layout above redirects to `/`, and this screen
 * unmounts.
 *
 * Rewritten off hardcoded hex onto `src/theme` (#46). The values are the same
 * ones it already used — the point is that they now come from one place, so
 * this screen cannot drift away from the app behind it.
 */
import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";

import { devLogin } from "../../src/auth/config";
import { usePasswordSignIn } from "../../src/auth/usePasswordSignIn";
import { colors, radius, spacing } from "../../src/theme";
import { PrimaryButton } from "../../src/ui/button";
import { Screen } from "../../src/ui/screen";
import { AppText } from "../../src/ui/text";

export default function SignIn() {
	const { submit, busy, error } = usePasswordSignIn();
	const [email, setEmail] = useState(devLogin?.email ?? "");
	const [password, setPassword] = useState(devLogin?.password ?? "");
	const passwordRef = useRef<TextInput>(null);

	const ready = email.trim().length > 0 && password.length > 0;

	return (
		<Screen>
			<View style={styles.root}>
				<View style={styles.brand}>
					<View style={styles.mark} />
					<AppText variant="display">Workouts</AppText>
					<AppText variant="caption">Log the set. Nothing else.</AppText>
				</View>

				<TextInput
					style={styles.input}
					placeholder="Email"
					placeholderTextColor={colors.textFaint}
					value={email}
					onChangeText={setEmail}
					autoCapitalize="none"
					autoCorrect={false}
					keyboardType="email-address"
					autoComplete="email"
					textContentType="username"
					returnKeyType="next"
					onSubmitEditing={() => passwordRef.current?.focus()}
				/>
				<TextInput
					ref={passwordRef}
					style={styles.input}
					placeholder="Password"
					placeholderTextColor={colors.textFaint}
					value={password}
					onChangeText={setPassword}
					secureTextEntry
					autoCapitalize="none"
					autoComplete="current-password"
					textContentType="password"
					returnKeyType="go"
					onSubmitEditing={() => ready && submit(email, password)}
				/>

				{error ? (
					<AppText variant="caption" style={{ color: colors.danger }}>
						{error}
					</AppText>
				) : null}

				{busy ? (
					<View style={styles.busy}>
						<ActivityIndicator color={colors.onAccent} />
					</View>
				) : (
					<PrimaryButton
						label="Sign in"
						disabled={!ready}
						style={!ready && styles.disabled}
						onPress={() => submit(email, password)}
					/>
				)}

				{devLogin ? (
					<AppText variant="caption" style={styles.devNote}>
						Dev build: test credentials pre-filled (EXPO_PUBLIC_TEST_USER_*).
					</AppText>
				) : null}
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: spacing.lg,
		gap: spacing.sm,
	},
	brand: { gap: spacing.xs, marginBottom: spacing.lg },
	mark: {
		width: 40,
		height: 40,
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
		marginBottom: spacing.sm,
	},
	input: {
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		paddingHorizontal: spacing.md,
		paddingVertical: 14,
		fontSize: 16,
		color: colors.text,
	},
	// Matches PrimaryButton's height so the layout does not jump on submit.
	busy: {
		backgroundColor: colors.accent,
		borderRadius: radius.pill,
		paddingVertical: 14,
		alignItems: "center",
	},
	disabled: { opacity: 0.5 },
	devNote: { textAlign: "center", marginTop: spacing.sm },
});
