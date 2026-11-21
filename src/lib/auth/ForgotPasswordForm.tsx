import { useSignIn } from "@clerk/react";
import { useState } from "react";
import { useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { orThrow, useClerkErrorMessage } from "./clerkError";
import { SecondFactorStep } from "./SecondFactorStep";
import { needsSecondFactor } from "./secondFactor";
import { UsernameHint } from "./UsernameHint";

/**
 * Emailed reset code, then a new password. On an account with MFA the reset
 * changes the password and then still asks for the second factor.
 */
export function ForgotPasswordForm({
	onSuccess,
	onBackToSignIn,
}: {
	onSuccess: () => void;
	/** Leaves the second-factor step; the password is already changed. */
	onBackToSignIn: () => void;
}) {
	const { signIn } = useSignIn();
	const { auth } = useMessages();
	const errorMessage = useClerkErrorMessage();
	const [step, setStep] = useState<"request" | "reset" | "secondFactor">(
		"request",
	);
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function requestCode(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await orThrow(signIn.create({ identifier: email }));
			await orThrow(signIn.resetPasswordEmailCode.sendCode());
			setStep("reset");
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	async function resetPassword(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			// A rejected password leaves the code verified; retrying must only
			// resubmit the password.
			if (signIn.status !== "needs_new_password") {
				await orThrow(signIn.resetPasswordEmailCode.verifyCode({ code }));
			}
			await orThrow(signIn.resetPasswordEmailCode.submitPassword({ password }));
			if (needsSecondFactor(signIn.status)) {
				setStep("secondFactor");
			} else if (signIn.status === "complete") {
				await orThrow(signIn.finalize());
				onSuccess();
			} else {
				setError(auth.forgotPassword.failed);
			}
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	if (step === "secondFactor") {
		return (
			<SecondFactorStep
				onSuccess={onSuccess}
				onBack={onBackToSignIn}
				notice={auth.secondFactor.passwordChanged}
			/>
		);
	}

	if (step === "reset") {
		return (
			<form onSubmit={resetPassword} noValidate className="flex flex-col gap-3">
				<AuthError message={error} />
				<UsernameHint username={email} />
				<AuthField
					label={auth.forgotPassword.code}
					type="text"
					autoComplete="one-time-code"
					value={code}
					onChange={setCode}
					required
				/>
				<AuthField
					label={auth.forgotPassword.newPassword}
					type="password"
					autoComplete="new-password"
					value={password}
					onChange={setPassword}
					required
				/>
				<AuthButton loading={loading}>{auth.forgotPassword.submit}</AuthButton>
			</form>
		);
	}

	return (
		<form onSubmit={requestCode} noValidate className="flex flex-col gap-3">
			<AuthError message={error} />
			<AuthField
				label={auth.email}
				type="email"
				autoComplete="username"
				value={email}
				onChange={setEmail}
				required
			/>
			<AuthButton loading={loading}>{auth.forgotPassword.sendCode}</AuthButton>
		</form>
	);
}
