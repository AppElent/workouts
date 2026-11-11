import { SHIPPED_EXERCISES } from "@foundry/core/exercises";
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { useLocalSearchParams } from "expo-router";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { Platform } from "react-native";
import * as ExerciseNewRoute from "../../../../app/(app)/exercise-new";
import { renderApp } from "../../../test-support/render-app";
import { AppText } from "../../../ui/text";

const originalOS = Platform.OS;
// The Android header renders Save and Cancel in the screen; iOS puts them in the native toolbar.
beforeEach(() => {
	Platform.OS = "android";
});
afterEach(() => {
	Platform.OS = originalOS;
});

function LibraryStub() {
	const { created } = useLocalSearchParams<{ created?: string }>();
	return <AppText>{`Library after ${created}`}</AppText>;
}

async function setup(
	save: jest.Mock,
	url = "/exercise-new",
	exercises: Record<string, unknown> = {},
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
	jest
		.mocked(useQuery)
		.mockImplementation(((ref: never, args: { id: string } | "skip") =>
			getFunctionName(ref) === "exercises:getById" && args !== "skip"
				? (exercises[args.id] ?? null)
				: undefined) as never);
	await renderApp(url, {
		"exercise-new": ExerciseNewRoute,
		exercises: { default: LibraryStub },
	});
}

const landedInLibrary = (name: string) =>
	screen.findByText(`Library after ${name}`);

it("blocks invalid weight steps and preserves the draft after a failed save", async () => {
	const save = jest.fn().mockRejectedValue(new Error("Save unavailable"));
	await setup(save);
	await fireEvent.changeText(screen.getByLabelText("Name"), " My press ");
	await fireEvent.changeText(
		screen.getByLabelText("Weight step (optional)"),
		"-1",
	);
	await fireEvent.press(screen.getByRole("button", { name: "Save" }));
	expect(save).not.toHaveBeenCalled();
	expect(screen.getByText("Enter a number greater than zero.")).toBeTruthy();
	await fireEvent.changeText(
		screen.getByLabelText("Weight step (optional)"),
		"2,5",
	);
	await fireEvent.press(screen.getByRole("button", { name: "Muscle groups" }));
	await fireEvent.press(screen.getByRole("checkbox", { name: "Chest" }));
	await fireEvent.press(screen.getByRole("checkbox", { name: "Arms" }));
	await fireEvent.changeText(
		screen.getByLabelText("Additional muscles (optional)"),
		"triceps, chest",
	);
	await fireEvent.press(screen.getByRole("button", { name: "Save" }));
	await waitFor(() =>
		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "My press",
				muscleGroups: ["chest", "arms", "triceps"],
				weightIncrement: 2.5,
			}),
		),
	);
	expect(
		await screen.findByText("Could not create the exercise."),
	).toBeTruthy();
	expect(screen.getByLabelText("Name").props.value).toBe(" My press ");
	expect(screen.queryByText(/Library after/)).toBeNull();
});

it("prevents duplicate submission and cancellation until save resolves", async () => {
	let resolve: () => void = () => {};
	const save = jest.fn(
		() =>
			new Promise<void>((r) => {
				resolve = r;
			}),
	);
	await setup(save);
	await fireEvent.changeText(screen.getByLabelText("Name"), "Test press");
	await fireEvent.press(screen.getByRole("button", { name: "Save" }));
	await fireEvent.press(screen.getByRole("button", { name: "Saving…" }));
	await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
	expect(save).toHaveBeenCalledTimes(1);
	expect(screen.getByLabelText("Name")).toBeTruthy();
	await act(async () => resolve());
	expect(await landedInLibrary("Test press")).toBeTruthy();
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
	await setup(
		create,
		"/exercise-new?edit=personal-id&returnTo=library",
		{ "personal-id": source },
		update,
	);
	expect(screen.getByLabelText("Name").props.value).toBe("My press");
	expect(screen.getByLabelText("Notes (optional)").props.value).toBe("Pause");
	await fireEvent.changeText(screen.getByLabelText("Name"), "My edited press");
	await fireEvent.changeText(screen.getByLabelText("Notes (optional)"), "");
	await fireEvent.press(screen.getByRole("button", { name: "Save" }));
	expect(await landedInLibrary("My edited press")).toBeTruthy();
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

it("clones a personal exercise's exact muscle names and instructions only after Save", async () => {
	const source = {
		...SHIPPED_EXERCISES[0],
		_id: "personal-squat",
		isDefault: false,
		muscleGroups: ["quads", "glutes", "hamstrings"],
		instructions: ["Keep your back straight."],
	};
	const create = jest.fn().mockResolvedValue("new-id");
	const update = jest.fn();
	await setup(
		create,
		"/exercise-new?clone=personal-squat",
		{ "personal-squat": source },
		update,
	);
	expect(screen.getByLabelText("Name").props.value).toBe(
		`${source.name} (copy)`,
	);
	expect(create).not.toHaveBeenCalled();
	await fireEvent.press(screen.getByRole("button", { name: "Save" }));
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
