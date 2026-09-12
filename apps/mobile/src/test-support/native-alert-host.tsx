import { type ReactNode, useEffect, useState } from "react";
import {
	ActionSheetIOS,
	Alert,
	type AlertButton,
	Modal,
	Pressable,
	Text,
	View,
} from "react-native";

/** A test driver for the OS alert boundary; production still calls Alert.alert. */
export function NativeAlertHost({ children }: { children: ReactNode }) {
	const [alert, setAlert] = useState<{
		title: string;
		message?: string;
		buttons: AlertButton[];
	}>();
	useEffect(() => {
		const sheetSpy = jest
			.spyOn(ActionSheetIOS, "showActionSheetWithOptions")
			.mockImplementation((options, callback) => {
				setAlert({
					title: options.title ?? "",
					buttons: options.options.map((text, index) => ({
						text,
						onPress: () => callback(index),
					})),
				});
			});
		const spy = jest
			.spyOn(Alert, "alert")
			.mockImplementation((title, message, buttons) => {
				setAlert({ title, message, buttons: buttons ?? [] });
			});
		return () => {
			spy.mockRestore();
			sheetSpy.mockRestore();
		};
	}, []);
	return (
		<>
			{children}
			{alert ? (
				<Modal visible transparent>
					<View accessibilityRole="alert">
						<Text>{alert.title}</Text>
						{alert.message ? <Text>{alert.message}</Text> : null}
						{alert.buttons.map((button) => (
							<Pressable
								key={button.text}
								accessibilityRole="button"
								onPress={() => {
									setAlert(undefined);
									button.onPress?.();
								}}
							>
								<Text>{button.text}</Text>
							</Pressable>
						))}
					</View>
				</Modal>
			) : null}
		</>
	);
}
