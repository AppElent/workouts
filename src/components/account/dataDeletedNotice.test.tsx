import { render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { ToastHost } from "#/components/ui/toast";
import { LocaleProvider } from "#/lib/i18n";
import {
	DATA_DELETED_SEARCH,
	dataDeletedSearch,
	useDataDeletedNotice,
} from "./dataDeletedNotice";

function Start({
	deleted,
	clear,
}: {
	deleted: "data" | undefined;
	clear: () => void;
}) {
	useDataDeletedNotice(deleted, clear);
	return null;
}

const tree = (deleted: "data" | undefined, clear: () => void) => (
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
	expect(dataDeletedSearch({ deleted: "account" })).toEqual({});
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
