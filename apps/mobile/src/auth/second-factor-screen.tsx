/**
 * The second step of a sign-in on an account with MFA (or a new device under
 * Device Trust): an authenticator code, a texted or emailed code, or a backup
 * code. Built like `sign-in-code` so it reads as the same flow.
 *
 * The default method's first code is sent once, on the first mount; the
 * `sent` route param keeps a remount from sending again. Each other method
 * the account has is a footer link; switching to a texted or emailed one
 * sends its code first.
 *
 * Leaving drops the Clerk attempt, so the sign-in screen starts clean: "Back
 * to sign in", Android back and the back gesture all go through `leave`.
 * Too many wrong codes or an expired attempt end it; then only the way back
 * is left. A verified code signs in; the `(auth)` layout redirects and this
 * screen unmounts.
 */
import { useAuth } from "@clerk/expo";
import { usePreventRemove, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { fmt, useI18n } from "../i18n";
import { PrimaryButton } from "../ui/button";
import { AuthInput, AuthLink, AuthMessage, AuthScreen } from "./auth-form";
import { type SecondFactorOption, sendsCode } from "./second-factor";
import { type SecondFactorEntry, useSecondFactor } from "./use-second-factor";

const CODE_LENGTH = 6;

export function SecondFactorScreen({
	from = "signIn",
	sent = false,
}: {
	from?: SecondFactorEntry;
	/** The first code already went out on an earlier mount. */
	sent?: boolean;
}) {
	const router = useRouter();
	const { isSignedIn } = useAuth();
	const copy = useI18n().t.secondFactor;
	const {
		options,
		strategy,
		switchTo,
		resend,
		sending,
		verify,
		cancel,
		ended,
		busy,
		error,
	} = useSecondFactor({
		sent,
		markSent: useCallback(() => router.setParams({ sent: "1" }), [router]),
	});
	const [code, setCode] = useState("");
	const [notice, setNotice] = useState<string | null>(
		from === "reset" ? copy.passwordChanged : null,
	);

	// Leaving waits for `cancel`; the effect then navigates without the hold.
	const [leaving, setLeaving] = useState(false);
	const [left, setLeft] = useState(false);
	useEffect(() => {
		if (left) router.dismissTo("/sign-in");
	}, [left, router]);
	async function leave() {
		// A verify in flight finishes first: it may already be signing in.
		if (leaving || busy) return;
		setLeaving(true);
		await cancel();
		setLeft(true);
	}
	usePreventRemove(!left && !isSignedIn, () => void leave());

	const current = options.find((option) => option.strategy === strategy);
	const backup = strategy === "backup_code";
	const ready = backup ? code.trim().length > 0 : code.length === CODE_LENGTH;
	const locked = busy || sending || leaving;

	function destination(option: SecondFactorOption) {
		return (
			option.safeIdentifier ??
			(option.strategy === "phone_code" ? copy.yourPhone : copy.yourEmail)
		);
	}

	function submit() {
		if (!ready || locked || ended) return;
		setNotice(null);
		void verify(code);
	}

	async function onResend() {
		setNotice(null);
		if (await resend()) setNotice(copy.resent);
	}

	async function onSwitch(next: SecondFactorOption) {
		setNotice(null);
		if (await switchTo(next.strategy)) setCode("");
	}

	const back = (
		<AuthLink
			label={copy.backToSignIn}
			disabled={leaving}
			onPress={() => void leave()}
		/>
	);

	if (!current) {
		return (
			<AuthScreen title={copy.title} footer={back}>
				<AuthMessage message={copy.noMethod} />
			</AuthScreen>
		);
	}

	return (
		<AuthScreen
			title={copy.title}
			subtitle={fmt(copy.prompt[current.strategy], {
				destination: destination(current),
			})}
			footer={
				<>
					{!ended && sendsCode(current.strategy) ? (
						<AuthLink
							label={copy.resend}
							onPress={onResend}
							disabled={locked}
						/>
					) : null}
					{ended
						? null
						: options
								.filter((option) => option.strategy !== current.strategy)
								.map((option) => (
									<AuthLink
										key={option.strategy}
										label={fmt(copy.switchTo[option.strategy], {
											destination: destination(option),
										})}
										onPress={() => onSwitch(option)}
										disabled={locked}
									/>
								))}
					{back}
				</>
			}
		>
			{ended ? null : (
				<AuthInput
					key={current.strategy}
					placeholder={backup ? copy.backupCode : copy.code}
					value={code}
					onChangeText={setCode}
					keyboardType={backup ? "default" : "number-pad"}
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete={backup ? "off" : "one-time-code"}
					textContentType={backup ? "none" : "oneTimeCode"}
					maxLength={backup ? undefined : CODE_LENGTH}
					editable={!leaving}
					autoFocus
					returnKeyType="go"
					onSubmitEditing={submit}
				/>
			)}

			<AuthMessage message={ended ? copy.attemptEnded : error} />
			<AuthMessage message={notice} tone="muted" />

			{ended ? null : (
				<PrimaryButton
					label={copy.submit}
					loading={busy}
					disabled={!ready || sending || leaving}
					onPress={submit}
					testID="second-factor-submit"
				/>
			)}
		</AuthScreen>
	);
}
