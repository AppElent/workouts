import { useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { useStalled } from "./stall";

/**
 * Shown while a social sign-in or sign-up, or its callback, waits for Clerk to
 * load. If Clerk takes too long, offers a reload, which keeps the URL, and the
 * plain form. Clerk loading after all still carries on.
 */
export function ResumePending({
	backLabel,
	onBack,
}: {
	backLabel: string;
	onBack: () => void;
}) {
	const { auth } = useMessages();
	const stalled = useStalled();

	if (!stalled) {
		return (
			<p className="text-center text-sm text-text-muted" role="status">
				{auth.wait}
			</p>
		);
	}
	return (
		<div className="flex flex-col gap-3">
			<AuthError message={auth.session.stalled} />
			<AuthButton type="button" onClick={() => window.location.reload()}>
				{auth.session.retry}
			</AuthButton>
			<button
				type="button"
				className="min-h-11 text-center text-xs text-text-muted hover:underline"
				onClick={onBack}
			>
				{backLabel}
			</button>
		</div>
	);
}
