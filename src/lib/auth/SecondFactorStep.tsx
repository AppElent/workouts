import { useSignIn } from "@clerk/react";
import { useEffect, useRef, useState } from "react";
import { fmt, useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { useClerkErrorMessage } from "./clerkError";
import {
	endsAttempt,
	locksMethod,
	type SecondFactorOption,
	type SecondFactorStrategy,
	secondFactorOptions,
	sendSecondFactorCode,
	sendsCode,
	verifySecondFactor,
} from "./secondFactor";

/**
 * The second step of a sign-in on an account with MFA (or a new device under
 * Device Trust): an authenticator code, a texted or emailed code, or a backup
 * code. Shared by every way into a sign-in; built like the emailed-code step
 * of `SignInForm` so it reads as the same flow.
 *
 * The default method's first code is sent once, on mount. Each other method
 * the account has is a link below; switching to a texted or emailed one sends
 * its code first. Too many wrong codes only lock the current method, so the
 * form stays open for a new code or another method. An attempt that expired
 * leaves only the way back. Going back drops the Clerk attempt so the next
 * sign-in starts clean.
 */
export function SecondFactorStep({
	onSuccess,
	onBack,
	notice: initialNotice = null,
}: {
	onSuccess?: () => void;
	onBack: () => void;
	/** Shown above the code field until the first action, e.g. after a reset. */
	notice?: string | null;
}) {
	const { signIn } = useSignIn();
	const { auth } = useMessages();
	const copy = auth.secondFactor;
	const errorMessage = useClerkErrorMessage();
	// Fixed at mount: going back empties the attempt before the form leaves.
	const [options] = useState(() =>
		secondFactorOptions(signIn.supportedSecondFactors),
	);
	const [strategy, setStrategy] = useState<SecondFactorStrategy | null>(
		() => options[0]?.strategy ?? null,
	);
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(initialNotice);
	const [loading, setLoading] = useState(false);
	const [ended, setEnded] = useState(false);

	function fail(err: unknown, current: SecondFactorStrategy) {
		if (endsAttempt(err)) {
			setEnded(true);
			return;
		}
		setError(
			locksMethod(err) && !sendsCode(current)
				? copy.methodLocked
				: errorMessage(err),
		);
	}

	async function run(
		current: SecondFactorStrategy,
		action: () => Promise<boolean>,
		{ keepNotice = false } = {},
	): Promise<boolean> {
		setError(null);
		if (!keepNotice) setNotice(null);
		setLoading(true);
		try {
			return await action();
		} catch (err) {
			fail(err, current);
			return false;
		} finally {
			setLoading(false);
		}
	}

	async function send(next: SecondFactorStrategy) {
		const { error } = await sendSecondFactorCode(signIn, next);
		if (error) throw error;
		return true;
	}

	// The default method's first code, under any notice the step opened with.
	// The ref covers an effect run twice.
	const firstSend = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: once, on mount; later sends go through resend and switchTo.
	useEffect(() => {
		if (firstSend.current || !strategy || !sendsCode(strategy)) return;
		firstSend.current = true;
		void run(strategy, () => send(strategy), { keepNotice: true });
	}, []);

	function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!strategy || loading || ended) return;
		if (signIn.status !== "complete" && !code.trim()) {
			setError(copy.codeMissing);
			return;
		}
		return run(strategy, async () => {
			// A verified factor whose `finalize()` failed only needs the retry.
			if (signIn.status !== "complete") {
				const { error } = await verifySecondFactor(
					signIn,
					strategy,
					code.trim(),
				);
				if (error) throw error;
			}
			if (signIn.status !== "complete") {
				setError(copy.notFinished);
				return false;
			}
			const { error } = await signIn.finalize();
			if (error) throw error;
			onSuccess?.();
			return true;
		});
	}

	function resend() {
		if (!strategy || loading) return;
		return run(strategy, async () => {
			await send(strategy);
			setNotice(copy.resent);
			return true;
		});
	}

	async function switchTo(next: SecondFactorStrategy) {
		if (loading || next === strategy) return;
		if (await run(next, () => send(next))) {
			setCode("");
			setStrategy(next);
		}
	}

	async function back() {
		if (loading) return;
		setLoading(true);
		try {
			await signIn.reset();
		} catch {
			// The attempt is dropped locally either way; nothing to show.
		}
		onBack();
	}

	const current = options.find((option) => option.strategy === strategy);

	// The form (and its focused field) leaves for the error view: keep focus
	// on the step so keyboard and screen-reader users land on the message.
	const errorView = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (ended) errorView.current?.focus();
	}, [ended]);

	function destination(option: SecondFactorOption) {
		return (
			option.safeIdentifier ??
			(option.strategy === "phone_code" ? copy.yourPhone : copy.yourEmail)
		);
	}

	const backLink = (
		<button
			type="button"
			className="hover:underline disabled:opacity-60"
			disabled={loading}
			onClick={back}
		>
			{copy.backToSignIn}
		</button>
	);

	if (!current || ended) {
		return (
			<div
				ref={errorView}
				tabIndex={-1}
				className="flex flex-col gap-3 outline-none"
			>
				<AuthError message={ended ? copy.attemptEnded : copy.noMethod} />
				<div className="mt-1 text-xs text-text-muted">{backLink}</div>
			</div>
		);
	}

	const backup = current.strategy === "backup_code";
	const others = options.filter((o) => o.strategy !== current.strategy);

	return (
		<form onSubmit={submit} noValidate className="flex flex-col gap-3">
			<h2 className="text-base font-semibold text-text">{copy.title}</h2>
			<AuthError message={error} />
			{/* Always mounted, so screen readers announce a notice set later. */}
			<p className="text-sm text-text empty:hidden" role="status">
				{notice}
			</p>
			<p className="text-sm text-text-muted">
				{fmt(copy.prompt[current.strategy], {
					destination: destination(current),
				})}
			</p>
			<AuthField
				key={current.strategy}
				label={backup ? copy.backupCode : copy.code}
				type="text"
				inputMode={backup ? "text" : "numeric"}
				autoComplete={backup ? "off" : "one-time-code"}
				autoFocus
				value={code}
				onChange={setCode}
				required
			/>
			<AuthButton loading={loading}>{copy.submit}</AuthButton>
			<div className="mt-1 flex flex-col items-start gap-2 text-xs text-text-muted">
				{sendsCode(current.strategy) ? (
					<button
						type="button"
						className="hover:underline disabled:opacity-60"
						disabled={loading}
						onClick={resend}
					>
						{copy.resend}
					</button>
				) : null}
				{others.map((option) => (
					<button
						key={option.strategy}
						type="button"
						className="hover:underline disabled:opacity-60"
						disabled={loading}
						onClick={() => switchTo(option.strategy)}
					>
						{fmt(copy.switchTo[option.strategy], {
							destination: destination(option),
						})}
					</button>
				))}
				{backLink}
			</div>
		</form>
	);
}
