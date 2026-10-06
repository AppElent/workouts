import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
	Keyboard,
	type KeyboardEvent,
	Platform,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";

/** Sheets share the screen's bottom edge, even when iOS expands a detent for typing. */
export function NutritionKeyboardOverlay({
	children,
}: {
	children: ReactNode;
}) {
	const { height } = useWindowDimensions();
	const [keyboardHeight, setKeyboardHeight] = useState(
		() => Keyboard.metrics()?.height ?? 0,
	);
	useEffect(() => {
		function update(event: KeyboardEvent) {
			Keyboard.scheduleLayoutAnimation(event);
			setKeyboardHeight(Math.max(0, height - event.endCoordinates.screenY));
		}
		const change = Keyboard.addListener(
			Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow",
			update,
		);
		const hide = Keyboard.addListener(
			Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
			() => setKeyboardHeight(0),
		);
		return () => {
			change.remove();
			hide.remove();
		};
	}, [height]);
	return (
		<View
			pointerEvents="box-none"
			style={[
				StyleSheet.absoluteFill,
				{ bottom: keyboardHeight, justifyContent: "flex-end" },
			]}
		>
			{children}
		</View>
	);
}
