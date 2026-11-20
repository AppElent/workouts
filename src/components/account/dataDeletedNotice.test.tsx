import { act, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { ToastHost } from "#/components/ui/toast";
import { LocaleProvider } from "#/lib/i18n";
import {
	accountDeleted,
	DATA_DELETED_SEARCH,
	type Deleted,
	dataDeletedSearch,
	useDataDeletedNotice,
} from "./dataDeletedNotice";

function Start({
	deleted,
	clear,
}: {
	deleted: Deleted | undefined;
	clear: () => void;
}) {
	useDataDeletedNotice(deleted, clear);
	return null;
}

const tree = (deleted: Deleted | undefined, clear: () => void) => (
	<StrictMode>
		<LocaleProvider initialLocale="en">
			<ToastHost>
				<Start deleted={deleted} clear={clear} />
			</ToastHost>
		</LocaleProvider>
	</StrictMode>
);

it("reads only its own search value", () => {
	const search = Object.fromEntries(new URLSearchParams(DATA_DELETED_SEARCH));
	expect(dataDeletedSearch(search)).toEqual({ deleted: "data" });
	expect(dataDeletedSearch({ deleted: "account" })).toEqual({
		deleted: "account",
	});
	expect(dataDeletedSearch({ deleted: "everything" })).toEqual({});
	expect(dataDeletedSearch({})).toEqual({});
});

it("confirms once that the data is gone and the login still works elsewhere", async () => {
	const clear = vi.fn();
	render(tree("data", clear));
	const notifications = within(
		screen.getByRole("region", { name: "Notifications" }),
	);
	expect(
		await notifications.findByText("Your Foundry data was deleted."),
	).toBeTruthy();
	expect(
		notifications.getByText(/still works in Gather, Fairway and Arcade Club/),
	).toBeTruthy();
	expect(
		notifications.getAllByText("Your Foundry data was deleted."),
	).toHaveLength(1);
	expect(clear).toHaveBeenCalledTimes(1);
});

it("says nothing on a plain visit", () => {
	const clear = vi.fn();
	render(tree(undefined, clear));
	expect(screen.queryByText("Your Foundry data was deleted.")).toBeNull();
	expect(clear).not.toHaveBeenCalled();
});

it("names the Apple outcome in the search Delete account lands on", () => {
	expect(accountDeleted("notLinked")).toBe("account");
	expect(accountDeleted("revoked")).toBe("accountAppleRevoked");
	expect(accountDeleted("notRevoked")).toBe("accountAppleNotRevoked");
});

it.each([
	["account", null],
	[
		"accountAppleRevoked",
		/Foundry no longer uses Sign in with Apple for you\.$/,
	],
	[
		"accountAppleNotRevoked",
		/Foundry could not stop Sign in with Apple for you\. To stop it yourself, go to account\.apple\.com/,
	],
] as const)("confirms a deleted account (%s)", async (deleted, apple) => {
	render(tree(deleted, vi.fn()));
	const notifications = within(
		screen.getByRole("region", { name: "Notifications" }),
	);
	expect(
		await notifications.findByText("Your AppElent account was deleted."),
	).toBeTruthy();
	const detail = notifications.getByText(/^Your login is gone/);
	if (apple) expect(detail.textContent).toMatch(apple);
	else expect(detail.textContent).not.toMatch(/Apple/);
});

it("keeps the steps to stop Sign in with Apple until they are dismissed", async () => {
	vi.useFakeTimers({ shouldAdvanceTime: true });
	try {
		render(tree("accountAppleNotRevoked", vi.fn()));
		const notifications = within(
			screen.getByRole("region", { name: "Notifications" }),
		);
		await notifications.findByText("Your AppElent account was deleted.");
		await act(() => vi.advanceTimersByTimeAsync(30_000));
		expect(
			notifications.getByText("Your AppElent account was deleted."),
		).toBeTruthy();
	} finally {
		vi.useRealTimers();
	}
});

it("lets the plain confirmation go by itself", async () => {
	vi.useFakeTimers({ shouldAdvanceTime: true });
	try {
		render(tree("accountAppleRevoked", vi.fn()));
		const notifications = within(
			screen.getByRole("region", { name: "Notifications" }),
		);
		await notifications.findByText("Your AppElent account was deleted.");
		await act(() => vi.advanceTimersByTimeAsync(30_000));
		await waitFor(() =>
			expect(
				notifications.queryByText("Your AppElent account was deleted."),
			).toBeNull(),
		);
	} finally {
		vi.useRealTimers();
	}
});
