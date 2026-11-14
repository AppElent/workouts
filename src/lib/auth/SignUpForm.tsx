import { useSignUp } from "@clerk/react";
import { useState } from "react";
import { fmt, useI18n } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { orThrow, useClerkErrorMessage } from "./clerkError";
import { AUTH_PATHS } from "./paths";
import { SocialButtons } from "./SocialButtons";

export function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
	const { signUp } = useSignUp();
	const { locale, messages } = useI18n();
	const { auth } = messages;
	const errorMessage = useClerkErrorMessage();
	const [step, setStep] = useState<"details" | "verify">("details");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function submitDetails(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await orThrow(signUp.password({ emailAddress: email, password }));
			await orThrow(signUp.verifications.sendEmailCode());
			setStep("verify");
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	async function submitCode(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await orThrow(signUp.verifications.verifyEmailCode({ code }));
			if (signUp.status === "complete") {
				await orThrow(signUp.finalize());
				onSuccess();
			} else {
				setError(auth.signUp.invalidCode);
			}
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	if (step === "verify") {
		return (
			<form onSubmit={submitCode} noValidate className="flex flex-col gap-3">
				<AuthError message={error} />
				<p className="text-sm text-[var(--auth-muted)]">
					{fmt(auth.signUp.codeSent, { email })}
				</p>
				<AuthField
					label={auth.signUp.code}
					type="text"
					autoComplete="one-time-code"
					value={code}
					onChange={setCode}
					required
				/>
				<AuthButton loading={loading}>{auth.signUp.verify}</AuthButton>
			</form>
		);
	}

	return (
		<form onSubmit={submitDetails} noValidate className="flex flex-col gap-3">
			<SocialButtons />
			<AuthError message={error} />
			<AuthField
				label={auth.email}
				type="email"
				autoComplete="email"
				value={email}
				onChange={setEmail}
				required
			/>
			<AuthField
				label={auth.password}
				type="password"
				autoComplete="new-password"
				value={password}
				onChange={setPassword}
				required
			/>
			{/*
			 * Clerk's legacy bot sign-up protection mounts its Turnstile widget here
			 * when `signUp.password()` runs; it shows a checkbox only to visitors it
			 * suspects are bots. Without this element Clerk falls back to an
			 * invisible widget that blocks them with no way to prove otherwise.
			 * `empty:-mt-3` cancels the form's gap while nothing is mounted.
			 */}
			<div
				id="clerk-captcha"
				className="empty:-mt-3"
				data-cl-size="flexible"
				data-cl-language={locale}
			/>
			<AuthButton loading={loading}>{auth.signUp.submit}</AuthButton>
			<div className="mt-1 text-center text-xs text-[var(--auth-muted)]">
				<a href={AUTH_PATHS.signIn} className="hover:underline">
					{auth.signUp.haveAccount}
				</a>
			</div>
		</form>
	);
}
