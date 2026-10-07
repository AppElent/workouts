import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Keyboard,
	type KeyboardEvent,
	Platform,
	StyleSheet,
	View,
} from "react-native";

/**
 * Pins its children to the top of the keyboard. The lift is how far the
 * keyboard overlaps this overlay's own frame, not the keyboard's height: a
 * sheet that already makes room for the keyboard (SwiftUI's) needs none, one
 * that does not needs it all, and a sheet ending above the screen edge less.
 */
export function NutritionKeyboardOverlay({
	children,
}: {
	children: ReactNode;
}) {
	const frame = useRef<View>(null);
	const [frameBottom, setFrameBottom] = useState<number>();
	const [keyboardTop, setKeyboardTop] = useState<number>();
	const measure = useCallback(() => {
		frame.current?.measureInWindow((_x, y, _width, height) =>
			setFrameBottom(y + height),
		);
	}, []);
	useEffect(() => {
		function update(event: KeyboardEvent) {
			Keyboard.scheduleLayoutAnimation(event);
			setKeyboardTop(event.endCoordinates.screenY);
			measure();
		}
		const change = Keyboard.addListener(
			Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow",
			update,
		);
		const hide = Keyboard.addListener(
			Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
			() => setKeyboardTop(undefined),
		);
		const metrics = Keyboard.metrics();
		if (metrics) setKeyboardTop(metrics.screenY);
		return () => {
			change.remove();
			hide.remove();
		};
	}, [measure]);
	const lift =
		keyboardTop === undefined || frameBottom === undefined
			? 0
			: Math.max(0, frameBottom - keyboardTop);
	return (
		<>
			{/* An unlifted twin of the overlay, so measuring is not moved by lifting. */}
			<View
				ref={frame}
				pointerEvents="none"
				onLayout={measure}
				style={StyleSheet.absoluteFill}
			/>
			<View
				pointerEvents="box-none"
				style={[
					StyleSheet.absoluteFill,
					{ bottom: lift, justifyContent: "flex-end" },
				]}
			>
				{children}
			</View>
		</>
	);
}
