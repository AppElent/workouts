// @vitest-environment jsdom
import { MUSCLE_GROUPS } from "@foundry/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MuscleMap } from "./MuscleMap";

afterEach(cleanup);

it.each([...new Set(Object.values(MUSCLE_GROUPS).flat())])(
	"shows a specific icon for the core muscle %s",
	(muscle) => {
		render(<MuscleMap muscleGroups={[muscle]} />);
		expect(screen.queryByAltText("Full body muscle group")).toBeNull();
		expect(screen.getAllByRole("img")).toHaveLength(1);
	},
);
