import { useMessages } from "#/lib/i18n";
import { useStalledOffline } from "#/lib/stalledOffline";

/**
 * Sits in the layout flow so it reserves its own row instead of covering the
 * page. No dismiss button: it disappears when the condition does.
 */
export function OfflineBanner() {
	const { shell } = useMessages();
	if (!useStalledOffline()) return null;

	return (
		<div
			role="status"
			className="flex shrink-0 items-center justify-center border-b border-warn-border bg-warn-soft px-4 py-2"
		>
			<p className="text-xs font-medium text-warn">{shell.offline.message}</p>
		</div>
	);
}
