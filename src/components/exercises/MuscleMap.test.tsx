// @vitest-environment jsdom
import { MUSCLE_GROUPS } from "@foundry/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { MuscleMap } from "./MuscleMap";

afterEach(cleanup);

it.each([...new Set(Object.values(MUSCLE_GROUPS).flat())])(
	"shows a specific icon for the core muscle %s",
	(muscle) => {
		render(
			<LocaleProvider initialLocale="en">
				<MuscleMap muscleGroups={[muscle]} />
			</LocaleProvider>,
		);
		expect(screen.queryByAltText("Full body muscle group")).toBeNull();
		expect(screen.getAllByRole("img")).toHaveLength(1);
	},
);

it("names the muscle in the current language", () => {
	render(
		<LocaleProvider initialLocale="nl">
			<MuscleMap muscleGroups={["glutes"]} />
		</LocaleProvider>,
	);
	expect(screen.getByAltText("Spiergroep Bilspieren")).toBeTruthy();
	expect(screen.getByText("Getrainde spiergroepen")).toBeTruthy();
});
