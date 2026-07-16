import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { ToastHost, useToast } from "./toast";

// Base UI mirrors each toast's title/description into a visually-hidden
// screen-reader announcement region, so the same text exists twice in the DOM.
// Scope assertions to the visible toast viewport (role="region" "Notifications")
// to disambiguate from that a11y clone.
function toastRegion() {
	return within(screen.getByRole("region", { name: "Notifications" }));
}

function Harness() {
	const toast = useToast();
	return (
		<div>
			<button
				type="button"
				onClick={() => toast.error("Save failed", "Please try again.")}
			>
				fire error
			</button>
			<button type="button" onClick={() => toast.success("Workout saved")}>
				fire success
			</button>
			<button type="button" onClick={() => toast.info("Heads up")}>
				fire info
			</button>
		</div>
	);
}

function renderHost() {
	render(
		<LocaleProvider initialLocale="en">
			<ToastHost>
				<Harness />
			</ToastHost>
		</LocaleProvider>,
	);
}

describe("ToastHost / useToast", () => {
	it("shows an error toast with title and description", async () => {
		renderHost();
		fireEvent.click(screen.getByText("fire error"));
		expect(await toastRegion().findByText("Save failed")).toBeTruthy();
		expect(toastRegion().getByText("Please try again.")).toBeTruthy();
	});

	it("shows a success toast with title only", async () => {
		renderHost();
		fireEvent.click(screen.getByText("fire success"));
		expect(await toastRegion().findByText("Workout saved")).toBeTruthy();
	});

	it("shows an info toast with title only", async () => {
		renderHost();
		fireEvent.click(screen.getByText("fire info"));
		expect(await toastRegion().findByText("Heads up")).toBeTruthy();
	});

	it("renders a dismiss control that removes the toast", async () => {
		renderHost();
		fireEvent.click(screen.getByText("fire error"));
		await toastRegion().findByText("Save failed");
		expect(screen.getByLabelText("Dismiss notification")).toBeTruthy();
		fireEvent.click(screen.getByLabelText("Dismiss notification"));
		expect(toastRegion().queryByText("Save failed")).toBeNull();
	});
});
