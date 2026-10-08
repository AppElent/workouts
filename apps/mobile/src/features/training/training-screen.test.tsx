jest.mock("../../ui/inset-list", () =>
	jest.requireActual("../../ui/inset-list.tsx"),
);
jest.mock("../../ui/selection-menu", () =>
	jest.requireActual("../../ui/selection-menu.tsx"),
);

import { useMutation, useQueries } from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen } from "expo-router/testing-library";
import * as TrainRoute from "../../../app/(app)/(coach)/train";
import * as RoutineRoute from "../../../app/(app)/routine-editor";
import { renderApp } from "../../test-support/render-app";

const routine = { _id: "routine-1", name: "Push day", exercises: [] };

const routines = [routine];

function pressLastDelete() {
	const button = screen
		.getAllByRole("button", { name: "Delete routine" })
		.at(-1);
	if (!button) throw new Error("Delete action missing");
	fireEvent.press(button);
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
	renderApp("/train", { train: TrainRoute, "routine-editor": RoutineRoute });
	expect(
		await screen.findByRole("button", { name: "Start Push day" }),
	).toBeTruthy();
	fireEvent.press(screen.getByRole("button", { name: "Actions for Push day" }));
	pressLastDelete();
	expect(await screen.findByText("Delete Push day?")).toBeTruthy();
	pressLastDelete();
	expect(await screen.findByText("Try again")).toBeTruthy();
	expect(screen.getByText("Push day")).toBeTruthy();
});
