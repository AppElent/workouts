import type { Exercise } from "@foundry/core/exercises";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type FunctionReference, getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { ExerciseForm } from "./ExerciseForm";

const createExercise = vi.fn();
const updateExercise = vi.fn();
vi.mock("convex/react", () => ({
	useMutation: (ref: FunctionReference<"mutation">) =>
		getFunctionName(ref) === "exercises:update"
			? updateExercise
			: createExercise,
}));

function renderForm(
	onSuccess = vi.fn(),
	{
		exercise,
		locale = "en",
	}: { exercise?: Exercise; locale?: "en" | "nl" } = {},
) {
	render(
		<LocaleProvider initialLocale={locale}>
			<ExerciseForm exercise={exercise} onSuccess={onSuccess} />
		</LocaleProvider>,
	);
	return onSuccess;
}

const PLANK = {
	_id: "personal-plank",
	_creationTime: 0,
	name: "Plank",
	muscleGroups: ["abs"],
	category: "isolation",
	equipment: "bodyweight",
	notes: "Squeeze glutes",
	isDefault: false,
	userId: "user-1",
} as unknown as Exercise;

function fill(label: RegExp, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
	fireEvent.submit(
		screen
			.getByRole("button", {
				name: /^(Add exercise|Save changes|Bewaar|Oefening toevoegen)$/,
			})
			.closest("form") as HTMLFormElement,
	);
}

describe("ExerciseForm", () => {
	beforeEach(() => {
		createExercise.mockReset();
		updateExercise.mockReset();
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
		fill(/^Muscle groups/, "Lats, Traps");
		submit();
		await waitFor(() => expect(onSuccess).toHaveBeenCalled());
		expect(createExercise).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Cable Row",
				muscleGroups: ["lats", "traps"],
			}),
		);
	});

	it("counts reps unless Seconds is chosen", async () => {
		createExercise.mockResolvedValue("exercise-id");
		const onSuccess = renderForm();
		fill(/^Name/, "Side plank");
		const measure = screen.getByRole("combobox", { name: "Measured in" });
		expect(measure).toHaveProperty("value", "reps");
		fireEvent.change(measure, { target: { value: "seconds" } });
		submit();
		await waitFor(() => expect(onSuccess).toHaveBeenCalled());
		expect(createExercise).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Side plank", measure: "seconds" }),
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
		fill(/^Muscle groups/, "lats");
		submit();
		expect((await screen.findByRole("alert")).textContent).toBe(
			"This already exists.",
		);
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it("edits a personal exercise in place, measure included", async () => {
		updateExercise.mockResolvedValue(null);
		const onSuccess = renderForm(vi.fn(), { exercise: PLANK });
		expect(screen.getByLabelText(/^Name/)).toHaveProperty("value", "Plank");
		expect(screen.getByLabelText(/^Notes/)).toHaveProperty(
			"value",
			"Squeeze glutes",
		);
		const measure = screen.getByRole("combobox", { name: "Measured in" });
		expect(measure).toHaveProperty("value", "reps");
		expect(screen.queryByText(/already logged/)).toBeNull();
		fireEvent.change(measure, { target: { value: "seconds" } });
		expect(
			screen.getByText("Sets you already logged will read this way too."),
		).toBeTruthy();
		fill(/^Notes/, "");
		submit();
		await waitFor(() => expect(onSuccess).toHaveBeenCalled());
		expect(createExercise).not.toHaveBeenCalled();
		expect(updateExercise).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "personal-plank",
				name: "Plank",
				muscleGroups: ["abs"],
				equipment: "bodyweight",
				measure: "seconds",
				notes: undefined,
			}),
		);
	});

	it("keeps the edit open and explains a refused save", async () => {
		updateExercise.mockRejectedValue(undefined);
		const onSuccess = renderForm(vi.fn(), { exercise: PLANK });
		submit();
		expect((await screen.findByRole("alert")).textContent).toBe(
			"Couldn't save exercise.",
		);
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it("speaks Dutch", async () => {
		renderForm(vi.fn(), { locale: "nl" });
		expect(screen.getByLabelText("Naam")).toBeTruthy();
		expect(screen.getByRole("combobox", { name: "Gemeten in" })).toBeTruthy();
		expect(screen.getByRole("option", { name: "Seconden" })).toBeTruthy();
		expect(screen.getByRole("option", { name: "Halterstang" })).toBeTruthy();
		expect(screen.getByRole("option", { name: "Samengesteld" })).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Oefening toevoegen" }),
		).toBeTruthy();
		submit();
		expect(await screen.findByText("Naam is verplicht")).toBeTruthy();
	});
});
