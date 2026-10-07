import { NavigationContext } from "expo-router/build/react-navigation/core";
import { useContext, useEffect, useState } from "react";
import { AppState } from "react-native";

/** Keep live subscriptions only while the containing screen and app are visible. */
export function useScreenQueryActive() {
	const navigation = useContext(NavigationContext);
	const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
	const [foreground, setForeground] = useState(
		() =>
			AppState.currentState !== "background" &&
			AppState.currentState !== "inactive",
	);
	useEffect(() => {
		setFocused(navigation?.isFocused() ?? true);
		const focus = navigation?.addListener("focus", () => setFocused(true));
		const blur = navigation?.addListener("blur", () => setFocused(false));
		const state = AppState.addEventListener("change", (next) =>
			setForeground(next === "active"),
		);
		return () => {
			focus?.();
			blur?.();
			state.remove();
		};
	}, [navigation]);
	return focused && foreground;
}
