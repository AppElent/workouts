/**
 * The code half of passwordless sign-in. `sign-in` already sent it, so this
 * screen never sends on mount (a remount would re-send, and Clerk rate-limits
 * that). `email` is only there to say where the code went.
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { fmt, useI18n } from "../i18n";
import { PrimaryButton } from "../ui/button";
import { AuthInput, AuthLink, AuthMessage, AuthScreen } from "./auth-form";
import { useEmailCodeSignIn } from "./use-email-code-sign-in";

const CODE_LENGTH = 6;

export function SignInCodeScreen({ email }: { email: string }) {
	const router = useRouter();
	const copy = useI18n().t.verifyEmail;
	const { verify, resend, resending, startOver, busy, error } =
		useEmailCodeSignIn();
	const [code, setCode] = useState("");
	const [notice, setNotice] = useState<string | null>(null);

	const ready = code.length === CODE_LENGTH;

	async function onResend() {
		setNotice(null);
		if (await resend()) setNotice(copy.resent);
	}

	return (
		<AuthScreen
			title={copy.title}
			subtitle={fmt(copy.subtitle, { email })}
			footer={
				<>
					<AuthLink
						label={copy.resend}
						onPress={onResend}
						disabled={resending}
					/>
					<AuthLink
						label={copy.changeEmail}
						onPress={async () => {
							await startOver();
							router.back();
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
				returnKeyType="go"
				onSubmitEditing={() => ready && !busy && verify(code)}
			/>

			<AuthMessage message={error} />
			<AuthMessage message={notice} tone="muted" />

			<PrimaryButton
				label={copy.submit}
				loading={busy}
				disabled={!ready}
				onPress={() => verify(code)}
			/>
		</AuthScreen>
	);
}
