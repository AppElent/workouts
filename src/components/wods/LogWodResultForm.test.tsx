// @vitest-environment jsdom
import type { Id } from "@convex/_generated/dataModel";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const log = vi.fn();
vi.mock("convex/react", () => ({ useMutation: () => log }));
vi.mock("@convex/_generated/api", () => ({
	api: { wodResults: { log: "log" } },
}));

import { LocaleProvider } from "#/lib/i18n";
import { LogWodResultForm } from "./LogWodResultForm";

afterEach(() => {
	cleanup();
	log.mockReset();
});

it("logs a load score in the chosen unit", async () => {
	log.mockResolvedValue(undefined);
	render(
		<LocaleProvider initialLocale="en">
			<LogWodResultForm wodId={"wod" as Id<"wods">} type="load" />
		</LocaleProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: /increase load/i }));
	fireEvent.change(screen.getByLabelText("Load unit"), {
		target: { value: "lbs" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Log Result" }));
	await vi.waitFor(() => expect(log).toHaveBeenCalled());
	expect(log).toHaveBeenCalledWith(
		expect.objectContaining({ load: 2.5, loadUnit: "lbs" }),
	);
});

it("shows the score form in Dutch", () => {
	render(
		<LocaleProvider initialLocale="nl">
			<LogWodResultForm wodId={"wod" as Id<"wods">} type="forTime" />
		</LocaleProvider>,
	);
	expect(screen.getByText("Tijdslimiet gehaald (niet afgemaakt)")).toBeTruthy();
	fireEvent.click(screen.getByRole("checkbox"));
	expect(screen.getByText("Herh.")).toBeTruthy();
	expect(
		screen.getByRole("button", { name: "Resultaat vastleggen" }),
	).toBeTruthy();
});

// APP-600: two steppers side by side overflow a phone-width card.
it.each(["forTime", "amrap"] as const)(
	"stacks the %s steppers below the sm breakpoint",
	(type) => {
		render(
			<LocaleProvider initialLocale="en">
				<LogWodResultForm wodId={"wod" as Id<"wods">} type={type} />
			</LocaleProvider>,
		);
		const steppers = screen.getAllByRole("button", { name: /^Increase/ });
		expect(steppers).toHaveLength(2);
		const grid = steppers[0].closest(".grid");
		expect(grid?.className).toContain("grid-cols-1");
		expect(grid?.className).toContain("sm:grid-cols-2");
	},
);
