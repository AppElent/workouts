jest.mock("../../../ui/inset-list", () =>
	jest.requireActual("../../../ui/inset-list.tsx"),
);
jest.mock("../../../ui/selection-menu", () =>
	jest.requireActual("../../../ui/selection-menu.tsx"),
);

import { useMutation, useQueries } from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen } from "expo-router/testing-library";
import * as TrainRoute from "../../../../app/(app)/(coach)/train";
import * as RoutineRoute from "../../../../app/(app)/routine-editor";
import {
	PREFERENCE_KEYS,
	removeLocal,
	writeLocal,
} from "../../../local-store/local-store";
import { renderApp } from "../../../test-support/render-app";

beforeEach(() => {
	removeLocal(PREFERENCE_KEYS.locale);
});

const routine = { _id: "routine-1", name: "Push day", exercises: [] };

const routines = [routine];

async function pressLastDelete() {
	const button = screen
		.getAllByRole("button", { name: "Delete routine" })
		.at(-1);
	if (!button) throw new Error("Delete action missing");
	await fireEvent.press(button);
}
it("gives the routine its own play target and keeps the row after failed deletion", async () => {
	jest
		.mocked(useQueries)
		.mockImplementation((queries) =>
			Object.fromEntries(
				Object.entries(queries).map(([key, request]) => [
					key,
					getFunctionName(request.query) === "routines:list" ? routines : null,
				]),
			),
		);
	const remove = jest.fn().mockRejectedValue(new Error("Try again"));
	jest
		.mocked(useMutation)
		.mockImplementation((reference) =>
			Object.assign(
				getFunctionName(reference) === "routines:remove" ? remove : jest.fn(),
				{ withOptimisticUpdate: jest.fn() },
			),
		);
	await renderApp("/train", {
		train: TrainRoute,
		"routine-editor": RoutineRoute,
	});
	expect(
		await screen.findByRole("button", { name: "Start Push day" }),
	).toBeTruthy();
	await fireEvent.press(
		screen.getByRole("button", { name: "Actions for Push day" }),
	);
	await pressLastDelete();
	expect(await screen.findByText("Delete Push day?")).toBeTruthy();
	await pressLastDelete();
	expect(await screen.findByText("Could not delete the routine.")).toBeTruthy();
	expect(screen.getByText("Push day")).toBeTruthy();
});

it("counts the exercise library in words, not as an object", async () => {
	jest.mocked(useQueries).mockImplementation(() => ({}));
	await renderApp("/train", { train: TrainRoute });
	expect(await screen.findByText(/^\d+ exercises$/)).toBeTruthy();
	expect(screen.queryByText(/\[object Object\]/)).toBeNull();
});

it("hides the Hosted workouts entry while they are parked", async () => {
	jest.mocked(useQueries).mockImplementation(() => ({}));
	await renderApp("/train", { train: TrainRoute });
	expect(await screen.findByText("WODs")).toBeTruthy();
	expect(screen.queryByText("Hosted workouts")).toBeNull();
});

it("counts the exercise library in Dutch", async () => {
	writeLocal(PREFERENCE_KEYS.locale, "nl");
	jest.mocked(useQueries).mockImplementation(() => ({}));
	await renderApp("/train", { train: TrainRoute });
	expect(await screen.findByText(/^\d+ oefeningen$/)).toBeTruthy();
	expect(screen.queryByText(/exercises/)).toBeNull();
});

function mockRoutines(exerciseCounts: number[]) {
	const listed = exerciseCounts.map((count, index) => ({
		_id: `routine-${index}`,
		name: `Routine ${index}`,
		exercises: Array.from({ length: count }, (_, position) => ({
			exerciseId: `exercise-${position}`,
			defaultSets: 3,
		})),
	}));
	jest
		.mocked(useQueries)
		.mockImplementation((queries) =>
			Object.fromEntries(
				Object.entries(queries).map(([key, request]) => [
					key,
					getFunctionName(request.query) === "routines:list" ? listed : null,
				]),
			),
		);
}

it("uses the singular for a routine with one exercise", async () => {
	mockRoutines([1, 2]);
	await renderApp("/train", { train: TrainRoute });
	expect(await screen.findByText("1 exercise · 3 sets")).toBeTruthy();
	expect(screen.getByText("2 exercises · 6 sets")).toBeTruthy();
});

it("uses the singular and plural in Dutch for routine exercise counts", async () => {
	writeLocal(PREFERENCE_KEYS.locale, "nl");
	mockRoutines([1, 2]);
	await renderApp("/train", { train: TrainRoute });
	expect(await screen.findByText("1 oefening · 3 sets")).toBeTruthy();
	expect(screen.getByText("2 oefeningen · 6 sets")).toBeTruthy();
});
