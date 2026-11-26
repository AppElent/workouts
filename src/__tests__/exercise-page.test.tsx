import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { expect, it, vi } from "vitest";

// Routes live in src/routes, where a test file would become a route, so the
// page is tested from here with the router reduced to what it uses.
vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: unknown) => ({
		options,
		useParams: () => ({ id: "shipped:exercise:barbell-bench-press" }),
	}),
	Link: ({ to, children }: { to: string; children: ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));
vi.mock("@clerk/react", () => ({ useAuth: () => ({ isSignedIn: true }) }));
vi.mock("@convex/_generated/api", () => ({
	api: {
		exercises: { getHistory: "getHistory" },
		oneRepMaxes: {
			getCurrentForExercise: "getCurrentForExercise",
			listForExercise: "listForExercise",
		},
	},
}));
const set = {
	exerciseId: "shipped:exercise:barbell-bench-press",
	reps: 8,
	weight: 60,
	unit: "kg",
	setType: "working",
	loggedAt: 1,
	sessionDate: 1,
};
vi.mock("convex/react", () => ({
	useQuery: (query: string) =>
		query === "getHistory"
			? [
					{ ...set, _id: "set-1", setNumber: 1, notes: "Narrow grip" },
					{ ...set, _id: "set-2", setNumber: 2 },
				]
			: query === "listForExercise"
				? []
				: null,
}));
vi.mock("#/lib/exercises", () => ({
	useExercise: () => ({
		_id: "shipped:exercise:barbell-bench-press",
		name: "Barbell Bench Press",
		category: "compound",
		equipment: "barbell",
		muscleGroups: ["chest"],
	}),
}));

import { LocaleProvider } from "#/lib/i18n";
import { Route } from "#/routes/_app/exercises/$id";

const Page = (
	Route as unknown as { options: { component: () => ReactElement } }
).options.component;

it("shows a set's note in the exercise's history, only on that set", () => {
	render(
		<LocaleProvider initialLocale="en">
			<Page />
		</LocaleProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "History" }));
	const cell = (number: string) =>
		screen.getByText((_, node) =>
			Boolean(node?.matches("td") && node.textContent?.startsWith(number)),
		);
	expect(cell("#1").textContent).toBe("#1Narrow grip");
	expect(cell("#2").textContent).toBe("#2");
});

it("follows the language setting", () => {
	render(
		<LocaleProvider initialLocale="nl">
			<Page />
		</LocaleProvider>,
	);
	expect(screen.getByText("Terug naar oefeningen")).toBeTruthy();
	expect(screen.getByText("Samengesteld")).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Geschiedenis" }));
	expect(screen.getByText("Setgeschiedenis (2 sets)")).toBeTruthy();
	expect(screen.getAllByText("Werkset")).toHaveLength(2);
});
