import { useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { useStalled } from "./stall";

/**
 * Shown while a social sign-in or sign-up waits for Clerk to load. If Clerk
 * takes too long, offers a reload, which keeps the resume marker, and the plain
 * form. Clerk loading after all still carries on.
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
			<AuthError message={auth.errors.network} />
			<AuthButton type="button" onClick={() => window.location.reload()}>
				{auth.session.retry}
			</AuthButton>
			<div className="mt-1 text-center text-xs text-text-muted">
				<button type="button" className="hover:underline" onClick={onBack}>
					{backLabel}
				</button>
			</div>
		</div>
	);
}
