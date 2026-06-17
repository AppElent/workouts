import { render, screen } from "@testing-library/react";
import { MuscleMap } from "./MuscleMap";

describe("MuscleMap", () => {
	it("renders image assets for targeted muscle groups", () => {
		render(<MuscleMap muscleGroups={["chest", "triceps"]} size="sm" />);

		expect(
			screen.getByRole("img", { name: /chest muscle group/i }),
		).toBeTruthy();
		expect(
			screen
				.getByRole("img", { name: /chest muscle group/i })
				.getAttribute("src"),
		).toBe("/muscle-icons/chest.png");
		expect(
			screen
				.getByRole("img", { name: /arms muscle group/i })
				.getAttribute("src"),
		).toBe("/muscle-icons/arms.png");
	});

	it("maps aliases to the same image without duplicating icons", () => {
		render(<MuscleMap muscleGroups={["quads", "quadriceps", "front delts"]} />);

		expect(
			screen.getByRole("img", { name: /quadriceps muscle group/i }),
		).toBeTruthy();
		expect(
			screen.getByRole("img", { name: /shoulders muscle group/i }),
		).toBeTruthy();
		expect(screen.getAllByRole("img")).toHaveLength(2);
	});

	it("uses the full-body image as a fallback", () => {
		render(<MuscleMap muscleGroups={["unknown"]} />);

		expect(
			screen.getByRole("img", { name: /full body muscle group/i }),
		).toBeTruthy();
		expect(
			screen
				.getByRole("img", { name: /full body muscle group/i })
				.getAttribute("src"),
		).toBe("/muscle-icons/full-body.png");
	});
});
