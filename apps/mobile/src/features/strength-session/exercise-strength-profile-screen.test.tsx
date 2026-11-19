/** The Krachtprofiel from the exercise page, with no session (APP-393). */
import { useMutation, useQueries, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen } from "expo-router/testing-library";
import * as ExerciseRoute from "../../../app/(app)/exercise/[id]";
import * as ProfileRoute from "../../../app/(app)/strength-profile";
import { renderApp } from "../../test-support/render-app";

const squat = "shipped:exercise:barbell-back-squat";
const measured = {
	_id: "orm-1",
	_creationTime: 1,
	userId: "test-user",
	exerciseId: squat,
	value: 100,
	unit: "kg",
	date: Date.UTC(2026, 9, 1),
	source: "actual",
	sourceSetId: "set-1",
};
const estimated = {
	...measured,
	_id: "orm-2",
	value: 108,
	source: "calculated",
	sourceSetId: "set-2",
};
let records: Record<string, unknown>[] = [];
const mutation = jest.fn();

function serve(name: string) {
	if (name === "oneRepMaxes:listForExercise") return records;
	if (name === "oneRepMaxes:getCurrentForExercise") return records[0] ?? null;
	if (name === "workoutSessions:getActive") return null;
	return [];
}
beforeEach(() => {
	records = [measured, estimated];
	mutation.mockReset();
	jest
		.mocked(useQuery)
		.mockImplementation((...args) => serve(getFunctionName(args[0])));
	jest
		.mocked(useQueries)
		.mockImplementation((queries) =>
			Object.fromEntries(
				Object.entries(queries).map(([key, request]) => [
					key,
					serve(getFunctionName(request.query)),
				]),
			),
		);
	jest.mocked(useMutation).mockImplementation(
		() =>
			Object.assign(mutation, {
				withOptimisticUpdate: jest.fn(() => mutation),
			}) as never,
	);
});

const mount = (id: string) =>
	renderApp(`/exercise/${id}`, {
		"exercise/[id]": ExerciseRoute,
		"strength-profile": ProfileRoute,
	});

it("opens the strength profile from the exercise page, read-only", async () => {
	await mount(squat);
	await fireEvent.press(
		await screen.findByRole("button", { name: "Strength profile" }),
	);
	expect(await screen.findByText("From measured 1RM 100 kg.")).toBeTruthy();
	// The Measured reference and the 100% row.
	expect(screen.getAllByText("100 kg")).toHaveLength(2);
	expect(screen.getByText("≈108 kg")).toBeTruthy();
	expect(screen.getByText("80%")).toBeTruthy();
	expect(screen.getByText("80 kg")).toBeTruthy();
	// Rows are a table to read: nothing to pick, apply or enter.
	expect(screen.queryByRole("button", { name: "80%" })).toBeNull();
	expect(screen.queryByText(/^Apply/)).toBeNull();
	expect(screen.queryByText("Pick a row")).toBeNull();
	expect(screen.queryByText("Enter 1RM")).toBeNull();

	await fireEvent.press(screen.getByText("Rep max"));
	expect(await screen.findByText("5 reps")).toBeTruthy();
	await fireEvent.press(screen.getByText("Percentages"));
	await fireEvent.changeText(
		screen.getByLabelText("Custom percentage"),
		"72,5",
	);
	expect(await screen.findByText("72.5 kg")).toBeTruthy();
	expect(mutation).not.toHaveBeenCalled();
});

it("prices percentages from a newer manual 1RM", async () => {
	records = [
		measured,
		{
			...measured,
			_id: "orm-3",
			value: 110,
			source: "manual",
			sourceSetId: undefined,
			date: Date.UTC(2026, 10, 1),
		},
	];
	await mount(squat);
	await fireEvent.press(
		await screen.findByRole("button", { name: "Strength profile" }),
	);
	expect(await screen.findByText("From manual 1RM 110 kg.")).toBeTruthy();
	expect(screen.getByText("Manual")).toBeTruthy();
	// The Manual reference and the 100% row.
	expect(screen.getAllByText("110 kg")).toHaveLength(2);
});

it("says percentages need a 1RM when there is none", async () => {
	records = [];
	await mount(squat);
	await fireEvent.press(
		await screen.findByRole("button", { name: "Strength profile" }),
	);
	expect(
		await screen.findByText(/Percentages appear once you have/),
	).toBeTruthy();
	expect(screen.queryByText("Enter 1RM")).toBeNull();
});

it("offers no strength profile for a bodyweight exercise", async () => {
	records = [];
	await mount("shipped:exercise:chin-up");
	expect(await screen.findAllByText("Chin-Up")).not.toHaveLength(0);
	expect(screen.queryByRole("button", { name: "Strength profile" })).toBeNull();
});
