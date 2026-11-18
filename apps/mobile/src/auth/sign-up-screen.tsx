/**
 * Create an account: email and password here, then the code on
 * `verify-email` (`useSignUp` sends it before navigating).
 *
 * `autoComplete="new-password"` is what makes the platform offer to generate
 * and save a password, which is what later fills the sign-in screen;
 * `passwordRules` keeps that generated password inside Clerk's policy.
 */
import { useRouter } from "expo-router";
import { useRef } from "react";
import type { TextInputInstance } from "react-native";
import { useI18n } from "../i18n";
import { PrimaryButton } from "../ui/button";
import { AuthInput, AuthLink, AuthMessage, AuthScreen } from "./auth-form";
import { SocialButtons } from "./social-buttons";
import {
	CLERK_PASSWORD_RULES,
	useCredentialFields,
} from "./use-credential-fields";
import { useSignUp } from "./use-sign-up";

export function SignUpScreen() {
	const router = useRouter();
	const copy = useI18n().t.signUp;
	const { create, busy, error } = useSignUp();
	const passwordRef = useRef<TextInputInstance>(null);
	// AutoFill can change a field without `onChangeText`; submit its final text.
	const form = useCredentialFields(
		{ email: "", password: "" },
		async (latest) => {
			if (busy || !latest.email.trim() || !latest.password) return;
			if (await create(latest.email, latest.password)) {
				router.push({
					pathname: "/verify-email",
					params: { email: latest.email.trim() },
				});
			}
		},
	);
	const { email, password } = form.values;

	const ready = email.trim().length > 0 && password.length > 0;

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
				{...form.field("email")}
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
				{...form.field("password")}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="new-password"
				textContentType="newPassword"
				passwordRules={CLERK_PASSWORD_RULES}
				returnKeyType="go"
				onSubmitEditing={form.submitFrom("password")}
			/>

			<AuthMessage message={error} />

			<PrimaryButton
				label={copy.submit}
				loading={busy}
				disabled={!ready && !form.editing}
				onPress={form.press}
			/>

			<SocialButtons />
		</AuthScreen>
	);
}
