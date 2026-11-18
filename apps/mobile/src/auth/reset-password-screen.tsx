/**
 * Second half of the password reset: the emailed code and the new password.
 * `forgot-password` already sent the code, so this screen never sends on
 * mount (Clerk rate-limits re-sends). A successful reset signs in; the
 * `(auth)` layout redirects and this screen unmounts.
 *
 * `textContentType="newPassword"` lets the platform suggest a strong password
 * and update the saved one for this account. Declining that suggestion can
 * clear the field natively without `onChangeText`, so the state also takes the
 * text from `onEndEditing`. Resend and "Use a different email" stay disabled
 * while a reset runs: all three act on the same Clerk attempt.
 */
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { fmt, useI18n } from "../i18n";
import { PrimaryButton } from "../ui/button";
import { AuthInput, AuthLink, AuthMessage, AuthScreen } from "./auth-form";
import { usePasswordReset } from "./use-password-reset";

const CODE_LENGTH = 6;

export function ResetPasswordScreen({ email }: { email: string }) {
	const router = useRouter();
	const copy = useI18n().t.resetPassword;
	const { reset, resend, startOver, busy, locked, error } = usePasswordReset();
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const [notice, setNotice] = useState<string | null>(null);
	const passwordRef = useRef<TextInputInstance>(null);

	const ready = code.length === CODE_LENGTH && password.length > 0;

	function submit() {
		if (ready && !locked) void reset(code, password);
	}

	async function onResend() {
		setNotice(null);
		if (await resend()) setNotice(copy.resent);
	}

	return (
		<AuthScreen
			title={copy.codeTitle}
			subtitle={fmt(copy.codeSubtitle, { email })}
			footer={
				<>
					<AuthLink label={copy.resend} onPress={onResend} disabled={locked} />
					<AuthLink
						label={copy.changeEmail}
						disabled={locked}
						onPress={async () => {
							if (await startOver()) router.back();
						}}
					/>
				</>
			}
		>
			<AuthInput
				placeholder={copy.code}
				value={code}
				onChangeText={setCode}
				keyboardType="number-pad"
				autoComplete="one-time-code"
				textContentType="oneTimeCode"
				maxLength={CODE_LENGTH}
				autoFocus
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={() => passwordRef.current?.focus()}
			/>
			<AuthInput
				ref={passwordRef}
				placeholder={copy.newPassword}
				value={password}
				onChangeText={setPassword}
				onEndEditing={(event) => setPassword(event.nativeEvent.text)}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="new-password"
				textContentType="newPassword"
				returnKeyType="go"
				onSubmitEditing={submit}
			/>

			<AuthMessage message={error} />
			<AuthMessage message={notice} tone="muted" />

			<PrimaryButton
				label={copy.submit}
				loading={busy}
				disabled={!ready || locked}
				onPress={submit}
			/>
		</AuthScreen>
	);
}
