import type { Doc } from "@convex/_generated/dataModel";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SetCard } from "./SetCard";
import { SetRow } from "./SetRow";

afterEach(cleanup);

const set = {
	_id: "set-1",
	exerciseId: "shipped:exercise:barbell-bench-press",
	setNumber: 1,
	reps: 8,
	weight: 60,
	unit: "kg",
	setType: "working",
} as Doc<"sets">;

function renderRow(value: Doc<"sets">) {
	render(
		<table>
			<tbody>
				<SetRow set={value} onEdit={vi.fn()} />
			</tbody>
		</table>,
	);
}

it("shows a set's note in its type cell", () => {
	renderRow({ ...set, notes: "Narrow grip" });
	const note = screen.getByText("Narrow grip");
	expect(note.closest("td")?.textContent).toBe("workingNarrow grip");
});

it("adds nothing to the row of a set without a note", () => {
	renderRow(set);
	expect(screen.getByText("working").closest("td")?.textContent).toBe(
		"working",
	);
});

it("shows and speaks a set's note on its card", () => {
	render(<SetCard set={{ ...set, notes: "Narrow grip" }} onEdit={vi.fn()} />);
	expect(screen.getByText("Narrow grip")).toBeTruthy();
	expect(
		screen.getByRole("button", { name: "Edit set 1, note: Narrow grip" }),
	).toBeTruthy();
});

it("adds nothing to the card of a set without a note", () => {
	render(<SetCard set={set} onEdit={vi.fn()} />);
	const card = screen.getByRole("button", { name: "Edit set 1" });
	expect(card.querySelector("p")).toBeNull();
});
