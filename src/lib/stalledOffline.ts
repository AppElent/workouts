/**
 * "This is not going to arrive", as distinct from "this has not arrived yet".
 *
 * Every full page load starts with the Convex socket disconnected, so reading
 * that alone would flash "you're offline" at someone on a good connection. The
 * notice waits out a grace period; reconnecting at any point cancels it.
 * Mirrors `apps/mobile/src/convex/stalled-offline.ts`, which is tied to React
 * Native's AppState and so is not shared.
 */
import { useConvexConnectionState } from "convex/react";
import { useEffect, useState } from "react";

export const OFFLINE_GRACE_MS = 2000;

export function useStalledOffline(): boolean {
	const { isWebSocketConnected } = useConvexConnectionState();
	const [stalled, setStalled] = useState(false);

	useEffect(() => {
		if (isWebSocketConnected) {
			setStalled(false);
			return;
		}
		const timer = setTimeout(() => setStalled(true), OFFLINE_GRACE_MS);
		return () => clearTimeout(timer);
	}, [isWebSocketConnected]);

	// Derived, so the banner drops on the same render the socket comes back.
	return stalled && !isWebSocketConnected;
}
