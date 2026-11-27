/** The Records tab's "Longest hold" tile counts confirmed working sets (APP-937). */
import { useMutation, useQueries, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen, within } from "expo-router/testing-library";
import * as ExerciseRoute from "../../../../app/(app)/exercise/[id]";
import { renderApp } from "../../../test-support/render-app";

const plank = "shipped:exercise:plank";
const day = Date.UTC(2026, 10, 18);
const hold = (
	id: string,
	setNumber: number,
	reps: number,
	extra: { setType?: "warmup" | "working"; performanceVerified?: boolean },
) => ({
	_id: id,
	sessionId: "s1",
	sessionDate: day,
	setNumber,
	weight: 0,
	unit: "kg" as const,
	reps,
	setType: extra.setType ?? "working",
	performanceVerified: extra.performanceVerified ?? true,
});
// A confirmed warm-up and an unconfirmed set both outlast the best confirmed
// working hold, so only the confirmed time is the record.
const history = [
	hold("warmup", 1, 90, { setType: "warmup" }),
	hold("best", 2, 45, {}),
	hold("unconfirmed", 3, 120, { performanceVerified: false }),
];

function serve(name: string) {
	if (name === "exercises:getHistory") return history;
	if (name === "oneRepMaxes:getCurrentForExercise") return null;
	if (name === "workoutSessions:getActive") return null;
	return [];
}
beforeEach(() => {
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
			Object.assign(jest.fn(), {
				withOptimisticUpdate: jest.fn(),
			}) as never,
	);
});

it("shows a hold's longest confirmed working time, not a warm-up or unconfirmed set", async () => {
	await renderApp(`/exercise/${plank}`, { "exercise/[id]": ExerciseRoute });
	await fireEvent.press(await screen.findByText("Records"));
	const label = await screen.findByText("Longest hold");
	const tile = label.parent?.parent;
	if (!tile) throw new Error("Longest hold tile not found");
	expect(within(tile).getByText("45 s")).toBeTruthy();
	expect(screen.queryByText("90 s")).toBeNull();
	expect(screen.queryByText("120 s")).toBeNull();
});
