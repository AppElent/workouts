import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Stepper } from "./Stepper";

describe("Stepper", () => {
	it("gives the label a column wide enough for Dutch labels and lets long labels wrap", () => {
		render(<Stepper label="Gewicht" value={0} onChange={() => {}} />);
		const label = screen.getByText("Gewicht");
		expect(label.className).toContain("w-16");
		expect(label.className).toContain("shrink-0");
		expect(label.className).toContain("break-words");
		expect(label.className).not.toContain("w-12");
	});

	it("keeps the buttons a fixed touch size so the value can shrink instead of overflowing", () => {
		render(
			<Stepper label="Load" value={102.5} unit="kg" onChange={() => {}} />,
		);
		for (const name of ["Decrease Load", "Increase Load"]) {
			const button = screen.getByRole("button", { name });
			expect(button.className).toContain("w-11");
			expect(button.className).toContain("shrink-0");
		}
		expect(screen.getByText("102.5").parentElement?.className).toContain(
			"min-w-0",
		);
	});

	it("steps within min and max", () => {
		const onChange = vi.fn();
		render(
			<Stepper label="Reps" value={9} max={10} step={2} onChange={onChange} />,
		);
		fireEvent.click(screen.getByRole("button", { name: "Increase Reps" }));
		expect(onChange).toHaveBeenLastCalledWith(10);
		fireEvent.click(screen.getByRole("button", { name: "Decrease Reps" }));
		expect(onChange).toHaveBeenLastCalledWith(7);
	});
});
