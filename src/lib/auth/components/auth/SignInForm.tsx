import { useSignIn } from "@clerk/react";
import { useState } from "react";
import { fmt, useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { useAuthConfig } from "./AuthConfigProvider";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { orThrow } from "./clerkResult";
import { SocialButtons } from "./SocialButtons";
import { TestLoginButton } from "./TestLoginButton";
import { clerkErrorMessage } from "./types";

/**
 * Email + password, or passwordless: "Email me a sign-in code" sends a
 * one-time code to the typed address and swaps the form for a code field.
 */
type SignIn = ReturnType<typeof useSignIn>["signIn"];

function hasEmailCodeFactor(signIn: SignIn) {
	return signIn.supportedFirstFactors.some((f) => f.strategy === "email_code");
}

export function SignInForm({ onSuccess }: { onSuccess: () => void }) {
	const { signIn } = useSignIn();
	const config = useAuthConfig();
	const { auth } = useMessages();
	const [step, setStep] = useState<"password" | "code">("password");
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
			setError(clerkErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	async function finish(signIn: SignIn) {
		if (signIn.status === "complete") {
			await orThrow(signIn.finalize());
			onSuccess();
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

	if (step === "code") {
		return (
			<form onSubmit={submitCode} noValidate className="flex flex-col gap-3">
				<AuthError message={error} />
				<p className="text-sm text-[var(--auth-muted)]">
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
					<p className="text-xs text-[var(--auth-muted)]" role="status">
						{notice}
					</p>
				) : null}
				<div className="mt-1 flex justify-between text-xs text-[var(--auth-muted)]">
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
				autoComplete="current-password"
				value={password}
				onChange={setPassword}
				required
			/>
			<AuthButton loading={loading}>{auth.signIn.submit}</AuthButton>
			<AuthButton
				type="button"
				variant="ghost"
				className="border-solid border-[var(--auth-border)]"
				loading={loading}
				onClick={sendCode}
			>
				{auth.signIn.emailCode}
			</AuthButton>
			<TestLoginButton onSuccess={onSuccess} />
			<div className="mt-1 flex justify-between text-xs text-[var(--auth-muted)]">
				{config.features.forgotPassword ? (
					<a href={config.paths.forgotPassword} className="hover:underline">
						{auth.signIn.forgotPassword}
					</a>
				) : (
					<span />
				)}
				<a href={config.paths.signUp} className="hover:underline">
					{auth.signIn.createAccount}
				</a>
			</div>
		</form>
	);
}
