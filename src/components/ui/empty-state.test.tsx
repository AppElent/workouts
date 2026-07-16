import { render, screen } from "@testing-library/react";
import { Dumbbell } from "lucide-react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
	it("renders title, description, and action", () => {
		render(
			<EmptyState
				icon={Dumbbell}
				title="No workouts yet"
				description="Start your first session to see it here."
				action={<button type="button">Start workout</button>}
			/>,
		);
		expect(screen.getByText("No workouts yet")).toBeTruthy();
		expect(
			screen.getByText("Start your first session to see it here."),
		).toBeTruthy();
		expect(screen.getByText("Start workout")).toBeTruthy();
	});

	it("renders with title only", () => {
		render(<EmptyState title="Nothing here" />);
		expect(screen.getByText("Nothing here")).toBeTruthy();
	});
});
