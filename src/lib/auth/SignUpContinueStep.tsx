import { useSignUp } from "@clerk/react";
import { clerkErrorCode } from "@foundry/core";
import { useEffect, useRef, useState } from "react";
import { fmt, useI18n } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { orThrow, useClerkErrorMessage } from "./clerkError";
import { AUTH_PATHS, withRedirect } from "./paths";
import { endsAttempt } from "./secondFactor";
import {
	type ContinueField,
	type ContinueValues,
	continuePhase,
	errorField,
	sendFieldCode,
	updateSignUp,
	verifyFieldCode,
} from "./signUpContinue";
import { UsernameHint } from "./UsernameHint";

const FIELD_PROPS = {
	email_address: { type: "email", autoComplete: "username" },
	username: { type: "text", autoComplete: "username" },
	first_name: { type: "text", autoComplete: "given-name" },
	last_name: { type: "text", autoComplete: "family-name" },
	phone_number: { type: "tel", autoComplete: "tel" },
	password: { type: "password", autoComplete: "new-password" },
} as const satisfies Record<
	ContinueField,
	{ type: string; autoComplete: string }
>;

/**
 * Finishes a social sign-up Clerk left at `missing_requirements`: asks only
 * for the fields Clerk reports, then for the code of an unverified email or
 * phone number. Which of the two shows follows the attempt, so whatever Clerk
 * still wants after a submit comes next. Starting over drops the attempt.
 */
export function SignUpContinueStep({
	onSuccess,
	onStartOver,
	redirect,
}: {
	onSuccess: () => void;
	onStartOver: () => void;
	redirect?: string;
}) {
	const { signUp } = useSignUp();
	const { locale, messages } = useI18n();
	const { auth } = messages;
	const copy = auth.signUpContinue;
	const errorMessage = useClerkErrorMessage();
	const [values, setValues] = useState<ContinueValues>({});
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const phase = continuePhase(signUp);
	const verifyField = phase.kind === "verify" ? phase.field : null;

	function failure(err: unknown) {
		if (endsAttempt(err)) return copy.attemptEnded;
		// The shared messages for these two say the email is at fault.
		const field = errorField(err);
		if (field && field !== "email_address") {
			const code = clerkErrorCode(err);
			if (code === "form_param_format_invalid") return copy.invalidDetails;
			if (code === "form_identifier_exists") return copy.taken;
		}
		return errorMessage(err);
	}

	async function run(action: () => Promise<void>) {
		setError(null);
		setNotice(null);
		setLoading(true);
		try {
			await action();
		} catch (err) {
			setError(failure(err));
		} finally {
			setLoading(false);
		}
	}

	// One code per field when its turn comes: on arrival, or after it is typed.
	const sentFor = useRef<string | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: once per field; later sends go through resend.
	useEffect(() => {
		if (!verifyField || loading || sentFor.current === verifyField) return;
		sentFor.current = verifyField;
		void run(() => orThrow(sendFieldCode(signUp, verifyField)));
	}, [verifyField, loading]);

	async function finishIfComplete() {
		if (signUp.status !== "complete") return;
		await orThrow(signUp.finalize());
		onSuccess();
	}

	function submit(e: React.FormEvent) {
		e.preventDefault();
		if (loading) return;
		if (
			phase.kind === "details" &&
			phase.fields.some((field) => !values[field]?.trim())
		) {
			setError(auth.errors.required);
			return;
		}
		if (phase.kind === "verify" && !code.trim()) {
			setError(auth.secondFactor.codeMissing);
			return;
		}
		return run(async () => {
			if (phase.kind === "details") {
				await orThrow(updateSignUp(signUp, phase.fields, values));
			} else if (phase.kind === "verify") {
				await orThrow(verifyFieldCode(signUp, phase.field, code.trim()));
				setCode("");
			}
			await finishIfComplete();
		});
	}

	function resend() {
		if (!verifyField || loading) return;
		return run(async () => {
			await orThrow(sendFieldCode(signUp, verifyField));
			setNotice(auth.secondFactor.resent);
		});
	}

	async function startOver() {
		if (loading) return;
		try {
			await signUp.reset();
		} catch {
			// The plain form starts a new attempt either way.
		}
		onStartOver();
	}

	const links = (
		<div className="mt-1 flex flex-col items-start gap-2 text-xs text-text-muted">
			{verifyField ? (
				<button
					type="button"
					className="hover:underline disabled:opacity-60"
					disabled={loading}
					onClick={resend}
				>
					{auth.secondFactor.resend}
				</button>
			) : null}
			<button
				type="button"
				className="hover:underline disabled:opacity-60"
				disabled={loading}
				onClick={startOver}
			>
				{copy.startOver}
			</button>
			<a
				href={withRedirect(AUTH_PATHS.signIn, redirect)}
				className="hover:underline"
			>
				{auth.signUp.haveAccount}
			</a>
		</div>
	);

	if (phase.kind === "unsupported") {
		return (
			<div className="flex flex-col gap-3">
				<AuthError message={copy.unsupported} />
				{links}
			</div>
		);
	}

	return (
		<form onSubmit={submit} noValidate className="flex flex-col gap-3">
			<h2 className="text-base font-semibold text-text">{copy.title}</h2>
			<AuthError message={error} />
			{/* Always mounted, so screen readers announce a notice set later. */}
			<p className="text-sm text-text empty:hidden" role="status">
				{notice}
			</p>
			{phase.kind === "details" ? (
				<>
					<p className="text-sm text-text-muted">{copy.intro}</p>
					{phase.fields.includes("password") &&
					!phase.fields.includes("email_address") &&
					signUp.emailAddress ? (
						<UsernameHint username={signUp.emailAddress} />
					) : null}
					{phase.fields.map((field, index) => (
						<AuthField
							key={field}
							label={copy.fields[field]}
							{...FIELD_PROPS[field]}
							autoFocus={index === 0}
							value={values[field] ?? ""}
							onChange={(value) =>
								setValues((current) => ({ ...current, [field]: value }))
							}
							required
						/>
					))}
				</>
			) : null}
			{phase.kind === "verify" ? (
				<>
					<p className="text-sm text-text-muted">
						{fmt(copy.codePrompt, {
							destination:
								(phase.field === "email_address"
									? signUp.emailAddress
									: signUp.phoneNumber) ??
								(phase.field === "email_address"
									? auth.secondFactor.yourEmail
									: auth.secondFactor.yourPhone),
						})}
					</p>
					<AuthField
						key={phase.field}
						label={auth.signUp.code}
						type="text"
						inputMode="numeric"
						autoComplete="one-time-code"
						autoFocus
						value={code}
						onChange={setCode}
						required
					/>
				</>
			) : null}
			{/* Clerk's bot check mounts here, as in `SignUpForm`. */}
			<div
				id="clerk-captcha"
				className="empty:-mt-3"
				data-cl-size="flexible"
				data-cl-language={locale}
			/>
			<AuthButton loading={loading}>
				{phase.kind === "verify" ? auth.signUp.verify : copy.submit}
			</AuthButton>
			{links}
		</form>
	);
}
