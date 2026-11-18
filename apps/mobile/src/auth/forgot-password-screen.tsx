/**
 * First half of the password reset: the address the code goes to. The
 * sign-in screen passes what was already typed there. `reset-password` takes
 * the code and the new password; see `usePasswordReset`.
 */
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { PrimaryButton } from "../ui/button";
import { AuthInput, AuthLink, AuthMessage, AuthScreen } from "./auth-form";
import { usePasswordReset } from "./use-password-reset";

export function ForgotPasswordScreen({
	email: initialEmail,
}: {
	email: string;
}) {
	const router = useRouter();
	const copy = useI18n().t.resetPassword;
	const { request, busy, error } = usePasswordReset();
	const [email, setEmail] = useState(initialEmail);
	// Going back while the request runs unmounts this screen; a late success
	// must not then push the code screen.
	const mounted = useRef(true);
	useEffect(
		() => () => {
			mounted.current = false;
		},
		[],
	);

	const ready = email.trim().length > 0;

	async function sendCode() {
		if (!ready || busy) return;
		if ((await request(email)) && mounted.current) {
			router.push({
				pathname: "/reset-password",
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
					label={copy.backToSignIn}
					onPress={router.back}
					disabled={busy}
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
				autoFocus={!initialEmail}
				returnKeyType="send"
				onSubmitEditing={sendCode}
			/>

			<AuthMessage message={error} />

			<PrimaryButton
				label={copy.sendCode}
				loading={busy}
				disabled={!ready}
				onPress={sendCode}
			/>
		</AuthScreen>
	);
}
