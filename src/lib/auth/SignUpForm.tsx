import { useAuth, useSignUp } from "@clerk/react";
import { useEffect, useState } from "react";
import { fmt, useI18n } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { orThrow, useClerkErrorMessage } from "./clerkError";
import { AUTH_PATHS, withRedirect } from "./paths";
import { ResumePending } from "./ResumePending";
import { SignUpContinueStep } from "./SignUpContinueStep";
import { SocialButtons } from "./SocialButtons";
import { isResumable, isSocialSignUp } from "./signUpContinue";

/**
 * Email + password with an emailed code. A social sign-up that `/sso-callback`
 * sends here with its attempt still open gets the continue step instead.
 */
export function SignUpForm({
	onSuccess,
	onStartOver,
	redirect,
	resumeSocial = false,
}: {
	onSuccess: () => void;
	/** The person left the pending or continue step for the plain form. */
	onStartOver?: () => void;
	/** Arrived from `/sso-callback`: carry on with its open social sign-up. */
	resumeSocial?: boolean;
	/** Where to land after signing up, carried to social sign-up and sign-in. */
	redirect?: string;
}) {
	const { signUp } = useSignUp();
	const { isLoaded } = useAuth();
	// Pending leaves for a form the person did not open: put them in it.
	const [resumed] = useState(resumeSocial);
	const { locale, messages } = useI18n();
	const { auth } = messages;
	const errorMessage = useClerkErrorMessage();
	const [step, setStep] = useState<
		"pending" | "continue" | "details" | "verify"
	>(resumeSocial ? "pending" : "details");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	// Only when sent from `/sso-callback`, and only a social attempt, so one
	// someone else left in this browser is not picked up. Decided once, after
	// Clerk loads: before that `signUp` is a placeholder.
	useEffect(() => {
		if (step !== "pending" || !isLoaded) return;
		setStep(isResumable(signUp) ? "continue" : "details");
	}, [step, isLoaded, signUp]);

	async function submitDetails(e: React.FormEvent) {
		e.preventDefault();
		// Until Clerk loads, `signUp` is a placeholder that hides an open attempt
		// and queues calls, so the check below would pass for any attempt.
		if (!isLoaded) return;
		setError(null);
		setLoading(true);
		try {
			// `password()` adds to an open attempt. An abandoned social one may be
			// someone else's, and its account must not end up on this sign-up, so
			// `create()` replaces it.
			await orThrow(
				isSocialSignUp(signUp)
					? signUp.create({ emailAddress: email, password })
					: signUp.password({ emailAddress: email, password }),
			);
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

	if (step === "pending") {
		return (
			<ResumePending
				backLabel={auth.signUp.backToSignUp}
				onBack={() => {
					setStep("details");
					onStartOver?.();
				}}
			/>
		);
	}

	if (step === "continue") {
		return (
			<SignUpContinueStep
				redirect={redirect}
				onSuccess={onSuccess}
				onStartOver={() => {
					setStep("details");
					onStartOver?.();
				}}
			/>
		);
	}

	if (step === "verify") {
		return (
			<form onSubmit={submitCode} noValidate className="flex flex-col gap-3">
				<AuthError message={error} />
				<p className="text-sm text-text-muted">
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
			<SocialButtons redirect={redirect} />
			<AuthError message={error} />
			<AuthField
				label={auth.email}
				type="email"
				autoComplete="username"
				autoFocus={resumed}
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
			<AuthButton loading={loading || !isLoaded}>
				{auth.signUp.submit}
			</AuthButton>
			<div className="mt-1 text-center text-xs text-text-muted">
				<a
					href={withRedirect(AUTH_PATHS.signIn, redirect)}
					className="hover:underline"
				>
					{auth.signUp.haveAccount}
				</a>
			</div>
		</form>
	);
}
