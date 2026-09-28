import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { SHIPPED_EXERCISES } from "@workouts/core/exercises";
import { useMutation } from "convex/react";
import { getFunctionName } from "convex/server";
import type { ComponentProps } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LocaleProvider } from "../i18n";
import { renderThemed } from "../test-support/render-themed";
import { ToastProvider } from "../ui/toast";
import { AddExerciseForm } from "./add-exercise-form";

function setup(
	save: jest.Mock,
	props: Partial<ComponentProps<typeof AddExerciseForm>> = {},
	update = save,
) {
	jest
		.mocked(useMutation)
		.mockImplementation(
			(ref) =>
				(getFunctionName(ref) === "exercises:update"
					? update
					: save) as unknown as ReturnType<typeof useMutation>,
		);
	const close = jest.fn();
	renderThemed(
		<SafeAreaProvider
			initialMetrics={{
				frame: { x: 0, y: 0, width: 390, height: 844 },
				insets: { top: 0, right: 0, bottom: 34, left: 0 },
			}}
		>
			<LocaleProvider>
				<ToastProvider>
					<AddExerciseForm {...props} onClose={close} />
				</ToastProvider>
			</LocaleProvider>
		</SafeAreaProvider>,
	);
	return close;
}
it("blocks invalid weight steps and preserves the draft after a failed save", async () => {
	const save = jest.fn().mockRejectedValue(new Error("Save unavailable"));
	const close = setup(save);
	fireEvent.changeText(screen.getByLabelText("Name"), " My press ");
	fireEvent.changeText(screen.getByLabelText("Weight step (optional)"), "-1");
	fireEvent.press(screen.getByRole("button", { name: "Save" }));
	expect(save).not.toHaveBeenCalled();
	expect(screen.getByText("Enter a number greater than zero.")).toBeTruthy();
	fireEvent.changeText(screen.getByLabelText("Weight step (optional)"), "2,5");
	fireEvent.press(screen.getByRole("button", { name: "Muscle groups" }));
	fireEvent.press(screen.getByRole("checkbox", { name: "Chest" }));
	fireEvent.press(screen.getByRole("checkbox", { name: "Arms" }));
	fireEvent.changeText(
		screen.getByLabelText("Additional muscles (optional)"),
		"triceps, chest",
	);
	fireEvent.press(screen.getByRole("button", { name: "Save" }));
	await waitFor(() =>
		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "My press",
				muscleGroups: ["chest", "arms", "triceps"],
				weightIncrement: 2.5,
			}),
		),
	);
	expect(await screen.findByText("Save unavailable")).toBeTruthy();
	expect(screen.getByLabelText("Name").props.value).toBe(" My press ");
	expect(close).not.toHaveBeenCalled();
});
it("prevents duplicate submission and cancellation until save resolves", async () => {
	let resolve: () => void = () => {};
	const save = jest.fn(
		() =>
			new Promise<void>((r) => {
				resolve = r;
			}),
	);
	const close = setup(save);
	fireEvent.changeText(screen.getByLabelText("Name"), "Test press");
	fireEvent.press(screen.getByRole("button", { name: "Save" }));
	fireEvent.press(screen.getByRole("button", { name: "Saving…" }));
	fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
	expect(save).toHaveBeenCalledTimes(1);
	expect(close).not.toHaveBeenCalled();
	await act(async () => resolve());
	expect(close).toHaveBeenCalledWith("Test press");
});

it("prefills and updates a personal exercise without creating another record", async () => {
	const source = {
		...SHIPPED_EXERCISES[0],
		_id: "personal-id",
		name: "My press",
		isDefault: false,
		muscleGroups: ["chest", "triceps"],
		notes: "Pause",
		weightIncrement: 1.25,
	};
	const create = jest.fn();
	const update = jest.fn().mockResolvedValue(null);
	const close = setup(create, { mode: "edit", exercise: source }, update);
	expect(screen.getByLabelText("Name").props.value).toBe("My press");
	expect(screen.getByLabelText("Notes (optional)").props.value).toBe("Pause");
	fireEvent.changeText(screen.getByLabelText("Name"), "My edited press");
	fireEvent.changeText(screen.getByLabelText("Notes (optional)"), "");
	fireEvent.press(screen.getByRole("button", { name: "Save" }));
	await waitFor(() => expect(close).toHaveBeenCalledWith("My edited press"));
	expect(update).toHaveBeenCalledWith(
		expect.objectContaining({
			id: "personal-id",
			name: "My edited press",
			muscleGroups: ["chest", "triceps"],
			notes: undefined,
		}),
	);
	expect(create).not.toHaveBeenCalled();
});

it("clones exact muscle names and instructions only after Save", async () => {
	const source = {
		...SHIPPED_EXERCISES[0],
		muscleGroups: ["quads", "glutes", "hamstrings"],
		instructions: ["Keep your back straight."],
	};
	const create = jest.fn().mockResolvedValue("new-id");
	const update = jest.fn();
	setup(create, { mode: "clone", exercise: source }, update);
	expect(screen.getByLabelText("Name").props.value).toBe(
		`${source.name} (copy)`,
	);
	expect(create).not.toHaveBeenCalled();
	fireEvent.press(screen.getByRole("button", { name: "Save" }));
	await waitFor(() =>
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				name: `${source.name} (copy)`,
				muscleGroups: source.muscleGroups,
				instructions: source.instructions,
			}),
		),
	);
	expect(update).not.toHaveBeenCalled();
});
