/**
 * Email and password. The one screen a signed-out user gets in this
 * scaffold — no sign-up, no password reset, no OAuth. Those are shell/UX
 * tickets, not this one.
 *
 * The submit does not navigate: `finalize()` (in `usePasswordSignIn`) flips
 * `isSignedIn`, the `(auth)` layout above redirects to `/`, and this screen
 * unmounts.
 */
import { useRef, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

import { devLogin } from "../../src/auth/config";
import { usePasswordSignIn } from "../../src/auth/usePasswordSignIn";

export default function SignIn() {
	const { submit, busy, error } = usePasswordSignIn();
	const [email, setEmail] = useState(devLogin?.email ?? "");
	const [password, setPassword] = useState(devLogin?.password ?? "");
	const passwordRef = useRef<TextInput>(null);

	const ready = email.trim().length > 0 && password.length > 0;

	return (
		<View style={styles.root}>
			<Text style={styles.heading}>Sign in</Text>

			<TextInput
				style={styles.input}
				placeholder="Email"
				placeholderTextColor="#8a8a8a"
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
				placeholderTextColor="#8a8a8a"
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="current-password"
				textContentType="password"
				returnKeyType="go"
				onSubmitEditing={() => ready && submit(email, password)}
			/>

			{error ? <Text style={styles.error}>{error}</Text> : null}

			<Pressable
				style={[styles.button, (!ready || busy) && styles.buttonDisabled]}
				disabled={!ready || busy}
				onPress={() => submit(email, password)}
			>
				{busy ? (
					<ActivityIndicator color="#000" />
				) : (
					<Text style={styles.buttonLabel}>Sign in</Text>
				)}
			</Pressable>

			{devLogin ? (
				<Text style={styles.devNote}>
					Dev build: test credentials pre-filled (EXPO_PUBLIC_TEST_USER_*).
				</Text>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		justifyContent: "center",
		padding: 24,
		gap: 12,
		backgroundColor: "#000000",
	},
	heading: {
		fontSize: 28,
		fontWeight: "800",
		color: "#ffffff",
		marginBottom: 12,
	},
	input: {
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.1)",
		backgroundColor: "#1a1a1a",
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 14,
		fontSize: 16,
		color: "#ffffff",
	},
	error: {
		color: "#ff6b6b",
		fontSize: 13,
	},
	button: {
		backgroundColor: "#1DB954",
		borderRadius: 999,
		paddingVertical: 14,
		alignItems: "center",
		marginTop: 8,
	},
	buttonDisabled: {
		opacity: 0.5,
	},
	buttonLabel: {
		color: "#000000",
		fontWeight: "700",
		fontSize: 16,
	},
	devNote: {
		color: "#b3b3b3",
		fontSize: 11,
		textAlign: "center",
		marginTop: 8,
	},
});
