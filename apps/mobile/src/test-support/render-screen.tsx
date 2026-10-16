import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LocaleProvider } from "../i18n";
import { AppearanceProvider } from "../theme";
import { ConfirmProvider } from "../ui/confirm-dialog";
import { ToastProvider } from "../ui/toast";
import { NativeAlertHost } from "./native-alert-host";

const metrics = {
	frame: { x: 0, y: 0, width: 390, height: 844 },
	insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * Renders one screen or component outside the router with the app-wide
 * providers it needs: gesture root, safe area, locale, theme, toasts, and confirmations.
 * iOS confirmations go through `Alert.alert`; `NativeAlertHost` renders them as
 * pressable buttons. Use `renderApp` instead when navigation is under test.
 */
export async function renderScreen(ui: ReactElement) {
	return await render(
		<GestureHandlerRootView>
			<SafeAreaProvider initialMetrics={metrics}>
				<LocaleProvider>
					<AppearanceProvider>
						<NativeAlertHost>
							<ToastProvider>
								<ConfirmProvider>{ui}</ConfirmProvider>
							</ToastProvider>
						</NativeAlertHost>
					</AppearanceProvider>
				</LocaleProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>,
	);
}
