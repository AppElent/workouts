import { useMutation, useQueries } from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { Pressable, Text } from "react-native";
import { renderApp } from "../../test-support/render-app";
import { useTrainExercise } from "./use-train-exercise";

const squat = { _id: "shipped:exercise:barbell-squat", name: "Barbell Squat" };
const routines: never[] = [];
let active: Record<string, unknown> | undefined | null = null;
const mutations = new Map<string, jest.Mock>();
const mutation = (name: string) => {
	const fn = mutations.get(name);
	if (!fn) throw new Error(`Mutation was not mounted: ${name}`);
	return fn;
};

function Probe() {
	const { train } = useTrainExercise();
	return (
		<Pressable accessibilityRole="button" onPress={() => void train(squat)}>
			<Text>Train now</Text>
		</Pressable>
	);
}
function Session() {
	return <Text>Session screen</Text>;
}

beforeEach(() => {
	mutations.clear();
	active = null;
	jest
		.mocked(useQueries)
		.mockImplementation((queries) =>
			Object.fromEntries(
				Object.entries(queries).map(([key, request]) => [
					key,
					getFunctionName(request.query) === "routines:list"
						? routines
						: active,
				]),
			),
		);
	jest.mocked(useMutation).mockImplementation((reference) => {
		const name = getFunctionName(reference);
		if (!mutations.has(name)) mutations.set(name, jest.fn());
		return Object.assign(mutation(name), {
			withOptimisticUpdate: jest.fn(),
		});
	});
});

const mount = () =>
	renderApp("/probe", {
		probe: { default: Probe },
		session: { default: Session },
	});

it("starts a session named after the exercise and opens it", async () => {
	await mount();
	mutation("workoutSessions:create").mockResolvedValue("session-1");
	await fireEvent.press(
		await screen.findByRole("button", { name: "Train now" }),
	);
	await waitFor(() =>
		expect(mutation("workoutSessions:create")).toHaveBeenCalledWith({
			exerciseId: squat._id,
			name: squat.name,
		}),
	);
	expect(await screen.findByText("Session screen")).toBeTruthy();
	expect(screen).toHavePathname("/session");
});

it("adds the exercise to the active session after confirming", async () => {
	active = { _id: "active-1", exercises: [] };
	await mount();
	await fireEvent.press(
		await screen.findByRole("button", { name: "Train now" }),
	);
	await fireEvent.press(
		await screen.findByRole("button", { name: "Add to session" }),
	);
	await waitFor(() =>
		expect(mutation("workoutSessions:addExercise")).toHaveBeenCalledWith({
			sessionId: "active-1",
			exerciseId: squat._id,
		}),
	);
	expect(await screen.findByText("Session screen")).toBeTruthy();
	expect(mutation("workoutSessions:create")).not.toHaveBeenCalled();
});

it("opens the active session directly when it already holds the exercise", async () => {
	active = { _id: "active-1", exercises: [{ exerciseId: squat._id }] };
	await mount();
	await fireEvent.press(
		await screen.findByRole("button", { name: "Train now" }),
	);
	expect(await screen.findByText("Session screen")).toBeTruthy();
	expect(mutation("workoutSessions:addExercise")).not.toHaveBeenCalled();
});

it("writes nothing when the active session is cancelled at the prompt", async () => {
	active = { _id: "active-1", exercises: [] };
	await mount();
	await fireEvent.press(
		await screen.findByRole("button", { name: "Train now" }),
	);
	await fireEvent.press(await screen.findByRole("button", { name: "Cancel" }));
	expect(screen).toHavePathname("/probe");
	expect(mutations.get("workoutSessions:addExercise")).not.toHaveBeenCalled();
	expect(mutations.get("workoutSessions:create")).not.toHaveBeenCalled();
});
