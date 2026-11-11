import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { AddExerciseForm } from "./AddExerciseForm";

const createExercise = vi.fn();
vi.mock("convex/react", () => ({ useMutation: () => createExercise }));

function renderForm(onSuccess = vi.fn()) {
	render(
		<LocaleProvider initialLocale="en">
			<AddExerciseForm onSuccess={onSuccess} />
		</LocaleProvider>,
	);
	return onSuccess;
}

function fill(label: RegExp, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
	fireEvent.submit(
		screen
			.getByRole("button", { name: "Add Exercise" })
			.closest("form") as HTMLFormElement,
	);
}

describe("AddExerciseForm", () => {
	beforeEach(() => {
		createExercise.mockReset();
	});

	it("shows field errors and does not save an empty form", async () => {
		renderForm();
		submit();
		expect(await screen.findByText("Name is required")).toBeTruthy();
		expect(createExercise).not.toHaveBeenCalled();
	});

	it("saves a valid exercise once and closes", async () => {
		createExercise.mockResolvedValue("exercise-id");
		const onSuccess = renderForm();
		fill(/^Name/, "Cable Row");
		fill(/^Muscle Groups/, "Lats, Traps");
		submit();
		await waitFor(() => expect(onSuccess).toHaveBeenCalled());
		expect(createExercise).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Cable Row",
				muscleGroups: ["lats", "traps"],
			}),
		);
	});

	it("saves an exercise without muscle groups and no increment for bodyweight", async () => {
		createExercise.mockResolvedValue("exercise-id");
		const onSuccess = renderForm();
		fill(/^Name/, "Push-up");
		fill(/^Weight increment/, "5");
		fireEvent.change(screen.getByLabelText("Equipment"), {
			target: { value: "bodyweight" },
		});
		submit();
		await waitFor(() => expect(onSuccess).toHaveBeenCalled());
		expect(createExercise).toHaveBeenCalledWith(
			expect.objectContaining({ muscleGroups: [], weightIncrement: undefined }),
		);
	});

	it("explains a refused save and keeps the form open", async () => {
		createExercise.mockRejectedValue(new ConvexError({ code: "duplicate" }));
		const onSuccess = renderForm();
		fill(/^Name/, "Cable Row");
		fill(/^Muscle Groups/, "lats");
		submit();
		expect((await screen.findByRole("alert")).textContent).toBe(
			"This already exists.",
		);
		expect(onSuccess).not.toHaveBeenCalled();
	});
});
