import { useConvexConnectionState } from "convex/react";
import { useMessages } from "#/lib/i18n";

export function OfflineBanner() {
	const { isWebSocketConnected } = useConvexConnectionState();
	const { shell } = useMessages();
	if (isWebSocketConnected) return null;

	return (
		<div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center py-2 px-4 bg-yellow-500/10 border-b border-yellow-500/20">
			<p className="text-xs text-yellow-400 font-medium">
				{shell.offline.message}
			</p>
		</div>
	);
}
