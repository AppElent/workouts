import { useConvexConnectionState } from "convex/react";
import { useMessages } from "#/lib/i18n";

export function OfflineBanner() {
	const { isWebSocketConnected } = useConvexConnectionState();
	const { shell } = useMessages();
	if (isWebSocketConnected) return null;

	return (
		<div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center py-2 px-4 bg-warn-soft border-b border-warn-border">
			<p className="text-xs text-warn font-medium">{shell.offline.message}</p>
		</div>
	);
}
