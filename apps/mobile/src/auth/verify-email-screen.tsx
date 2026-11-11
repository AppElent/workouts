/**
 * The 6-digit code that proves the address belongs to the person signing up.
 * `email` is only there so the screen can say it back — "we sent a code to
 * *this*" is what sends someone to the right inbox.
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { fmt, useI18n } from "../i18n";
import { PrimaryButton } from "../ui/button";
import { AuthInput, AuthLink, AuthMessage, AuthScreen } from "./auth-form";
import { useVerifyEmail } from "./use-verify-email";

const CODE_LENGTH = 6;

export function VerifyEmailScreen({ email }: { email: string }) {
	const router = useRouter();
	const copy = useI18n().t.verifyEmail;
	const { verify, resend, busy, error } = useVerifyEmail();
	const [code, setCode] = useState("");
	const [notice, setNotice] = useState<string | null>(null);

	const ready = code.length === CODE_LENGTH;

	function submit() {
		setNotice(null);
		verify(code);
	}

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
					<AuthLink label={copy.resend} onPress={onResend} />
					<AuthLink label={copy.changeEmail} onPress={() => router.back()} />
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
				onSubmitEditing={() => ready && !busy && submit()}
			/>

			<AuthMessage message={error} />
			<AuthMessage message={notice} tone="muted" />

			<PrimaryButton
				label={copy.submit}
				loading={busy}
				disabled={!ready}
				onPress={submit}
			/>
		</AuthScreen>
	);
}
