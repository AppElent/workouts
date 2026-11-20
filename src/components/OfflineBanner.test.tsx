import { act, render, screen } from "@testing-library/react";
import { useConvexConnectionState } from "convex/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { en } from "#/lib/i18n/messages/en";
import { OFFLINE_GRACE_MS } from "#/lib/stalledOffline";
import { OfflineBanner } from "./OfflineBanner";

vi.mock("convex/react", () => ({ useConvexConnectionState: vi.fn() }));

const mockConnection = vi.mocked(useConvexConnectionState);

function connected(isWebSocketConnected: boolean) {
	mockConnection.mockReturnValue({
		isWebSocketConnected,
	} as ReturnType<typeof useConvexConnectionState>);
}

const ui = () => (
	<LocaleProvider initialLocale="en">
		<OfflineBanner />
	</LocaleProvider>
);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("does not flash while the socket connects on a cold load", () => {
	connected(false);
	const view = render(ui());
	expect(screen.queryByText(en.shell.offline.message)).toBeNull();

	connected(true);
	view.rerender(ui());
	act(() => {
		vi.advanceTimersByTime(OFFLINE_GRACE_MS);
	});
	expect(screen.queryByText(en.shell.offline.message)).toBeNull();
});

it("shows once the socket stays down past the grace period", () => {
	connected(false);
	render(ui());
	act(() => {
		vi.advanceTimersByTime(OFFLINE_GRACE_MS - 1);
	});
	expect(screen.queryByText(en.shell.offline.message)).toBeNull();
	act(() => {
		vi.advanceTimersByTime(1);
	});
	expect(screen.getByText(en.shell.offline.message)).toBeTruthy();
});

it("hides again when the socket reconnects", () => {
	connected(false);
	const view = render(ui());
	act(() => {
		vi.advanceTimersByTime(OFFLINE_GRACE_MS);
	});
	connected(true);
	view.rerender(ui());
	expect(screen.queryByText(en.shell.offline.message)).toBeNull();
});
