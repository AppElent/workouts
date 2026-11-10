/**
 * Create an account: email and password here, then the code on
 * `verify-email` (`useSignUp` sends it before navigating).
 *
 * `autoComplete="new-password"` is what makes the platform offer to generate
 * and save a password, which is what later fills the sign-in screen.
 */
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { useI18n } from "../i18n";
import { PrimaryButton } from "../ui/button";
import { AuthInput, AuthLink, AuthMessage, AuthScreen } from "./auth-form";
import { SocialButtons } from "./social-buttons";
import { useSignUp } from "./use-sign-up";

export function SignUpScreen() {
	const router = useRouter();
	const copy = useI18n().t.signUp;
	const { create, busy, error } = useSignUp();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const passwordRef = useRef<TextInputInstance>(null);

	const ready = email.trim().length > 0 && password.length > 0;

	async function submit() {
		if (await create(email, password)) {
			router.push({
				pathname: "/verify-email",
				params: { email: email.trim() },
			});
		}
	}

	return (
		<AuthScreen
			title={copy.title}
			subtitle={copy.subtitle}
			footer={
				<AuthLink
					prompt={copy.haveAccount}
					label={copy.signIn}
					onPress={() => router.replace("/sign-in")}
				/>
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
				autoComplete="new-password"
				textContentType="newPassword"
				returnKeyType="go"
				onSubmitEditing={() => ready && !busy && submit()}
			/>

			<AuthMessage message={error} />

			<PrimaryButton
				label={copy.submit}
				loading={busy}
				disabled={!ready}
				onPress={submit}
			/>

			<SocialButtons />
		</AuthScreen>
	);
}
