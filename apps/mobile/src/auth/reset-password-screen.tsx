/**
 * Second half of the password reset: the emailed code and the new password.
 * `forgot-password` already sent the code, so this screen never sends on
 * mount (Clerk rate-limits re-sends). A successful reset signs in; the
 * `(auth)` layout redirects and this screen unmounts.
 *
 * `textContentType="newPassword"` lets the platform suggest a strong password
 * and update the saved one for this account. Declining that suggestion can
 * clear the field natively without `onChangeText`, so the state also takes the
 * text from `onEndEditing`. Resend and "Use a different email" stay disabled,
 * and the screen cannot be left, while any of them runs: all three act on the
 * same Clerk attempt as sign-in. After Clerk
 * accepts the password the fields lock and the button only signs in (or
 * reopens the second-factor step); when Clerk wants a step this app cannot
 * do, the screen ends with a way back.
 */
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { fmt, useI18n } from "../i18n";
import { PrimaryButton } from "../ui/button";
import { AuthInput, AuthLink, AuthMessage, AuthScreen } from "./auth-form";
import { HoldWhileBusy } from "./hold-while-busy";
import { usePasswordReset } from "./use-password-reset";

const CODE_LENGTH = 6;

export function ResetPasswordScreen({ email }: { email: string }) {
	const router = useRouter();
	const copy = useI18n().t.resetPassword;
	const { reset, finish, stage, resend, startOver, busy, locked, error } =
		usePasswordReset();
	// Once Clerk has the new password, the fields are final: the button only
	// signs in, and the code links no longer apply.
	const entering = stage === "entering";
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const [notice, setNotice] = useState<string | null>(null);
	const passwordRef = useRef<TextInputInstance>(null);
	// "Use a different email" goes back once the start-over has released the
	// hold; an effect never runs after unmount, so a late one pops nothing.
	const [leaving, setLeaving] = useState(false);
	useEffect(() => {
		if (leaving && !locked) router.back();
	}, [leaving, locked, router]);

	const ready = code.length === CODE_LENGTH && password.length > 0;

	/** `typed` is the field's native text when the keyboard's Go submits. */
	function submit(typed: string = password) {
		if (locked) return;
		if (stage === "saved") void finish();
		else if (code.length === CODE_LENGTH && typed && entering)
			void reset(code, typed);
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
				entering ? (
					<>
						<AuthLink
							label={copy.resend}
							onPress={onResend}
							disabled={locked}
						/>
						<AuthLink
							label={copy.changeEmail}
							disabled={locked}
							onPress={async () => {
								if (await startOver()) setLeaving(true);
							}}
						/>
					</>
				) : stage === "unsupported" ? (
					<AuthLink
						label={copy.backToSignIn}
						onPress={() => router.dismissTo("/sign-in")}
					/>
				) : null
			}
		>
			<HoldWhileBusy busy={locked} />
			<AuthInput
				placeholder={copy.code}
				value={code}
				onChangeText={setCode}
				keyboardType="number-pad"
				autoComplete="one-time-code"
				textContentType="oneTimeCode"
				maxLength={CODE_LENGTH}
				editable={entering}
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
				editable={entering}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="new-password"
				textContentType="newPassword"
				returnKeyType="go"
				onSubmitEditing={(event) => {
					setPassword(event.nativeEvent.text);
					submit(event.nativeEvent.text);
				}}
			/>

			<AuthMessage message={error} />
			<AuthMessage
				message={stage === "entering" ? notice : copy.saved}
				tone="muted"
			/>

			{stage === "unsupported" ? null : (
				<PrimaryButton
					label={stage === "saved" ? copy.finishSignIn : copy.submit}
					loading={busy}
					disabled={locked || (entering && !ready)}
					onPress={() => submit()}
				/>
			)}
		</AuthScreen>
	);
}
