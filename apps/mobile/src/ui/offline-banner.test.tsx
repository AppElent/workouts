import { act, screen } from "@testing-library/react-native";
import { useConvexConnectionState } from "convex/react";
import type { ReactElement, ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OFFLINE_GRACE_MS } from "../data/stalled-offline";
import { LocaleProvider } from "../i18n";
import { en } from "../i18n/messages/en";
import { renderThemed } from "../test-support/render-themed";
import { OfflineBanner } from "./offline-banner";

const mockConnection = jest.mocked(useConvexConnectionState);

const render = async (ui: ReactElement) =>
	await renderThemed(ui, {
		wrapper: ({ children }: { children: ReactNode }) => (
			<SafeAreaProvider
				initialMetrics={{
					frame: { x: 0, y: 0, width: 390, height: 844 },
					insets: { top: 47, left: 0, right: 0, bottom: 34 },
				}}
			>
				<LocaleProvider>{children}</LocaleProvider>
			</SafeAreaProvider>
		),
	});

function connected(isWebSocketConnected: boolean) {
	mockConnection.mockReturnValue({
		isWebSocketConnected,
	} as ReturnType<typeof useConvexConnectionState>);
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("does not flash while the socket connects on start", async () => {
	connected(false);
	const view = await render(<OfflineBanner />);
	expect(screen.queryByText(en.common.offline)).toBeNull();

	connected(true);
	await view.rerender(<OfflineBanner />);
	await act(() => jest.advanceTimersByTime(OFFLINE_GRACE_MS));
	expect(screen.queryByText(en.common.offline)).toBeNull();
});

it("shows once the socket stays down past the grace period", async () => {
	connected(false);
	await render(<OfflineBanner />);
	await act(() => jest.advanceTimersByTime(OFFLINE_GRACE_MS));
	expect(screen.getByText(en.common.offline)).toBeTruthy();
});
