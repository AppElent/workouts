/**
 * Email and password. No reset and no OAuth yet: each is a Clerk flow with its
 * own screens. New accounts start at `sign-up`.
 *
 * The submit does not navigate: `finalize()` (in `usePasswordSignIn`) flips
 * `isSignedIn`, the `(auth)` layout above redirects to `/`, and this screen
 * unmounts.
 *
 * `autoComplete` / `textContentType` are what let the platform password
 * manager fill this — and offer to save the password made on `sign-up`.
 */
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";

import {
	AuthInput,
	AuthLink,
	AuthMessage,
	AuthScreen,
	AuthSubmit,
} from "../../src/auth/auth-form";
import { devLogin } from "../../src/auth/config";
import { usePasswordSignIn } from "../../src/auth/usePasswordSignIn";
import { useI18n } from "../../src/i18n";
import { AppText } from "../../src/ui/text";

export default function SignIn() {
	const router = useRouter();
	const copy = useI18n().t.signIn;
	const { submit, busy, error } = usePasswordSignIn();
	const [email, setEmail] = useState(devLogin?.email ?? "");
	const [password, setPassword] = useState(devLogin?.password ?? "");
	const passwordRef = useRef<TextInput>(null);

	const ready = email.trim().length > 0 && password.length > 0;

	return (
		<AuthScreen
			title="Foundry"
			subtitle={copy.tagline}
			footer={
				<>
					<AuthLink
						prompt={copy.noAccount}
						label={copy.createAccount}
						onPress={() => router.replace("/sign-up")}
					/>
					{devLogin ? (
						<AppText variant="caption" style={{ textAlign: "center" }}>
							{copy.devNote}
						</AppText>
					) : null}
				</>
			}
		>
			<AuthInput
				placeholder={copy.email}
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				autoCorrect={false}
				keyboardType="email-address"
				autoComplete="email"
				textContentType="username"
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={() => passwordRef.current?.focus()}
			/>
			<AuthInput
				ref={passwordRef}
				placeholder={copy.password}
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="current-password"
				textContentType="password"
				returnKeyType="go"
				onSubmitEditing={() => ready && submit(email, password)}
			/>

			<AuthMessage message={error} />

			<AuthSubmit
				label={copy.submit}
				busy={busy}
				disabled={!ready}
				onPress={() => submit(email, password)}
			/>
		</AuthScreen>
	);
}
