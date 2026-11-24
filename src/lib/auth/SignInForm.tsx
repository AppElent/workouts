import { useAuth, useSignIn } from "@clerk/react";
import { useEffect, useState } from "react";
import { fmt, useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { orThrow, useClerkErrorMessage } from "./clerkError";
import { AUTH_PATHS, withRedirect } from "./paths";
import { ResumePending } from "./ResumePending";
import { SecondFactorStep } from "./SecondFactorStep";
import { SocialButtons } from "./SocialButtons";
import { needsSecondFactor } from "./secondFactor";
import { TestLoginButton } from "./TestLoginButton";

type SignIn = ReturnType<typeof useSignIn>["signIn"];

function hasEmailCodeFactor(signIn: SignIn) {
	return signIn.supportedFirstFactors.some((f) => f.strategy === "email_code");
}

/**
 * Email + password, or passwordless: "Email me a sign-in code" sends a
 * one-time code to the typed address and swaps the form for a code field.
 * An account with MFA (or a new device under Device Trust) then gets the
 * second-factor step, as does a social sign-in that `/sso-callback` sends
 * back here with its attempt still open.
 */
export function SignInForm({
	onSuccess,
	onStartOver,
	redirect,
	resumeSocial = false,
}: {
	onSuccess?: () => void;
	/** The person left the pending or second-factor step for the plain form. */
	onStartOver?: () => void;
	/** Arrived from `/sso-callback`: carry on with its open social sign-in. */
	resumeSocial?: boolean;
	/** Where to land after signing in, carried to social sign-in, sign-up, and password reset. */
	redirect?: string;
}) {
	const { signIn } = useSignIn();
	const { isLoaded } = useAuth();
	const { auth } = useMessages();
	const errorMessage = useClerkErrorMessage();
	const [step, setStep] = useState<
		"pending" | "password" | "code" | "secondFactor"
	>(resumeSocial ? "pending" : "password");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function run(action: (signIn: SignIn) => Promise<void>) {
		setError(null);
		setNotice(null);
		setLoading(true);
		try {
			await action(signIn);
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	// A social sign-in that needs a second factor comes back from
	// `/sso-callback` with the attempt still open: carry on with it. Only when
	// sent from there, and only an OAuth attempt, so an attempt someone else
	// left in this browser is not picked up. Decided once, after Clerk loads:
	// before that `signIn` is a placeholder.
	useEffect(() => {
		if (step !== "pending" || !isLoaded) return;
		setStep(
			signIn.firstFactorVerification?.strategy?.startsWith("oauth_") &&
				needsSecondFactor(signIn.status)
				? "secondFactor"
				: "password",
		);
	}, [step, isLoaded, signIn]);

	async function finish(signIn: SignIn) {
		if (needsSecondFactor(signIn.status)) {
			setStep("secondFactor");
			return;
		}
		if (signIn.status === "complete") {
			await orThrow(signIn.finalize());
			onSuccess?.();
		} else {
			setError(auth.signIn.needsVerification);
		}
	}

	function submitPassword(e: React.FormEvent) {
		e.preventDefault();
		return run(async (signIn) => {
			await orThrow(signIn.password({ identifier: email, password }));
			await finish(signIn);
		});
	}

	function sendCode() {
		return run(async (signIn) => {
			await orThrow(signIn.create({ identifier: email }));
			if (!hasEmailCodeFactor(signIn)) {
				setError(auth.signIn.codeUnavailable);
				return;
			}
			await orThrow(signIn.emailCode.sendCode());
			setCode("");
			setStep("code");
		});
	}

	function resendCode() {
		return run(async (signIn) => {
			await orThrow(signIn.emailCode.sendCode());
			setNotice(auth.signIn.resent);
		});
	}

	function submitCode(e: React.FormEvent) {
		e.preventDefault();
		return run(async (signIn) => {
			await orThrow(signIn.emailCode.verifyCode({ code }));
			await finish(signIn);
		});
	}

	if (step === "pending") {
		return (
			<ResumePending
				backLabel={auth.secondFactor.backToSignIn}
				onBack={() => {
					setStep("password");
					onStartOver?.();
				}}
			/>
		);
	}

	if (step === "secondFactor") {
		return (
			<SecondFactorStep
				onSuccess={onSuccess}
				onBack={() => {
					setError(null);
					setNotice(null);
					setCode("");
					setStep("password");
					onStartOver?.();
				}}
			/>
		);
	}

	if (step === "code") {
		return (
			<form onSubmit={submitCode} noValidate className="flex flex-col gap-3">
				<AuthError message={error} />
				<p className="text-sm text-text-muted">
					{fmt(auth.signIn.codeSent, { email })}
				</p>
				<AuthField
					label={auth.signIn.code}
					type="text"
					autoComplete="one-time-code"
					value={code}
					onChange={setCode}
					required
				/>
				<AuthButton loading={loading}>{auth.signIn.verify}</AuthButton>
				{notice ? (
					<p className="text-xs text-text-muted" role="status">
						{notice}
					</p>
				) : null}
				<div className="mt-1 flex justify-between text-xs text-text-muted">
					<button
						type="button"
						className="hover:underline"
						onClick={resendCode}
					>
						{auth.signIn.resend}
					</button>
					<button
						type="button"
						className="hover:underline"
						onClick={() => {
							setError(null);
							setNotice(null);
							setStep("password");
						}}
					>
						{auth.signIn.usePassword}
					</button>
				</div>
			</form>
		);
	}

	return (
		<form onSubmit={submitPassword} noValidate className="flex flex-col gap-3">
			<SocialButtons redirect={redirect} />
			<AuthError message={error} />
			<AuthField
				label={auth.email}
				type="email"
				autoComplete="username"
				value={email}
				onChange={setEmail}
				required
			/>
			<AuthField
				label={auth.password}
				type="password"
				autoComplete="current-password"
				value={password}
				onChange={setPassword}
				required
			/>
			<AuthButton loading={loading}>{auth.signIn.submit}</AuthButton>
			<AuthButton
				type="button"
				variant="ghost"
				className="border-solid border-border"
				loading={loading}
				onClick={sendCode}
			>
				{auth.signIn.emailCode}
			</AuthButton>
			<TestLoginButton onSuccess={onSuccess} />
			<div className="mt-1 flex justify-between text-xs text-text-muted">
				<a
					href={withRedirect(AUTH_PATHS.forgotPassword, redirect)}
					className="hover:underline"
				>
					{auth.signIn.forgotPassword}
				</a>
				<a
					href={withRedirect(AUTH_PATHS.signUp, redirect)}
					className="hover:underline"
				>
					{auth.signIn.createAccount}
				</a>
			</div>
		</form>
	);
}
