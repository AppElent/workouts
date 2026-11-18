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
	useCredentialField,
} from "./use-credential-field";
import { useSignUp } from "./use-sign-up";

export function SignUpScreen() {
	const router = useRouter();
	const copy = useI18n().t.signUp;
	const { create, busy, error } = useSignUp();
	const email = useCredentialField();
	const password = useCredentialField();
	const passwordRef = useRef<TextInputInstance>(null);

	const ready = email.value.trim().length > 0 && password.value.length > 0;

	async function submit() {
		const address = email.latest();
		const secret = password.latest();
		if (!address.trim() || !secret) return;
		if (await create(address, secret)) {
			router.push({
				pathname: "/verify-email",
				params: { email: address.trim() },
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
				{...email.props}
				autoCapitalize="none"
				autoCorrect={false}
				keyboardType="email-address"
				autoComplete="username"
				textContentType="username"
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={() => passwordRef.current?.focus()}
			/>
			<AuthInput
				ref={passwordRef}
				placeholder={copy.password}
				{...password.props}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="new-password"
				textContentType="newPassword"
				passwordRules={CLERK_PASSWORD_RULES}
				returnKeyType="go"
				onSubmitEditing={(event) => {
					password.sync(event.nativeEvent.text);
					if (!busy) void submit();
				}}
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
