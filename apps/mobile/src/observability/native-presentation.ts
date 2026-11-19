/**
 * The only place the app presents an OS alert, action sheet or image picker.
 *
 * Each is presented from the root view controller, the same one Sentry's
 * feedback form needs, so a shake while one is open strands the form's backdrop
 * (APP-258, the same failure as APP-216). These wrappers hold shake-to-report
 * for as long as the presentation is up and release on every way out.
 * `biome.json` bans importing `Alert`, `ActionSheetIOS` and `expo-image-picker`
 * anywhere else.
 */

import * as ImagePicker from "expo-image-picker";
import {
	ActionSheetIOS,
	type ActionSheetIOSOptions,
	Alert,
	type AlertButton,
	type AlertOptions,
} from "react-native";
import { holdShakeToReport } from "./shake-to-report";

export type {
	ImagePickerAsset,
	ImagePickerOptions,
	ImagePickerResult,
} from "expo-image-picker";
export {
	requestCameraPermissionsAsync,
	requestMediaLibraryPermissionsAsync,
} from "expo-image-picker";

/** `Alert.alert`, holding shake-to-report until a button or the dismissal. */
export function showAlert(
	title: string,
	message?: string,
	buttons?: AlertButton[],
	options?: AlertOptions,
) {
	const release = holdShakeToReport();
	// With no buttons iOS adds an OK nobody can observe, so name it here.
	const shown = buttons?.length ? buttons : [{ text: "OK" }];
	try {
		Alert.alert(
			title,
			message,
			shown.map((button) => ({
				...button,
				onPress: (value?: string) => {
					release();
					button.onPress?.(value);
				},
			})),
			{
				...options,
				onDismiss: () => {
					release();
					options?.onDismiss?.();
				},
			},
		);
	} catch (error) {
		release();
		throw error;
	}
}

/** `ActionSheetIOS.showActionSheetWithOptions`, held until a choice or a tap away. */
export function showActionSheet(
	options: ActionSheetIOSOptions,
	callback: (buttonIndex: number) => void,
) {
	const release = holdShakeToReport();
	try {
		ActionSheetIOS.showActionSheetWithOptions(options, (index) => {
			release();
			callback(index);
		});
	} catch (error) {
		release();
		throw error;
	}
}

async function whilePickerOpen<T>(open: () => Promise<T>): Promise<T> {
	const release = holdShakeToReport();
	try {
		return await open();
	} finally {
		release();
	}
}

export function launchImageLibraryAsync(
	options?: ImagePicker.ImagePickerOptions,
) {
	return whilePickerOpen(() => ImagePicker.launchImageLibraryAsync(options));
}

export function launchCameraAsync(options?: ImagePicker.ImagePickerOptions) {
	return whilePickerOpen(() => ImagePicker.launchCameraAsync(options));
}
