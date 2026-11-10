// @vitest-environment jsdom
import type { Id } from "@convex/_generated/dataModel";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const log = vi.fn();
vi.mock("convex/react", () => ({ useMutation: () => log }));
vi.mock("@convex/_generated/api", () => ({
	api: { wodResults: { log: "log" } },
}));

import { LogWodResultForm } from "./LogWodResultForm";

afterEach(() => {
	cleanup();
	log.mockReset();
});

it("logs a load score in the chosen unit", async () => {
	log.mockResolvedValue(undefined);
	render(<LogWodResultForm wodId={"wod" as Id<"wods">} type="load" />);
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
