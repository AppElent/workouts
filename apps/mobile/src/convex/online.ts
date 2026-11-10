import { useConvexConnectionState } from "convex/react";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

/** The one "online" rule: the socket is up and the app is in the foreground. */
export function useOnline(): boolean {
	const { isWebSocketConnected } = useConvexConnectionState();
	const [foreground, setForeground] = useState(
		() => AppState.currentState !== "background",
	);
	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) =>
			setForeground(state === "active"),
		);
		return () => subscription.remove();
	}, []);
	return isWebSocketConnected && foreground;
}
