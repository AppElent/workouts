import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

// Routes live in src/routes, where a test file would become a route, so the
// page is tested from here with the router reduced to what it uses.
vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: unknown) => ({ options }),
	Link: ({ to, children }: { to: string; children: ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));
vi.mock("@clerk/react", () => ({
	Show: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@convex/_generated/api", () => ({
	api: { exercises: { remove: "remove" } },
}));
const removeExercise = vi.fn(async () => null);
vi.mock("convex/react", () => ({ useMutation: () => removeExercise }));
vi.mock("#/components/exercises/ExerciseFormModal", () => ({
	ExerciseFormModal: () => null,
}));
vi.mock("#/lib/exercises", () => ({
	useExercises: () => [
		{
			_id: "shipped:exercise:barbell-bench-press",
			name: "Barbell Bench Press",
			category: "compound",
			equipment: "barbell",
			muscleGroups: ["chest", "Front Delts "],
			isDefault: true,
		},
		{
			_id: "personal-1",
			name: "Cable Fly",
			category: "isolation",
			equipment: "cable",
			muscleGroups: ["chest"],
			isDefault: false,
		},
	],
}));

import { ConfirmDialogProvider } from "#/components/ui/confirm-dialog";
import { ToastHost } from "#/components/ui/toast";
import { LocaleProvider } from "#/lib/i18n";
import { Route } from "#/routes/_app/exercises/index";

const Page = (
	Route as unknown as { options: { component: () => ReactElement } }
).options.component;

function renderPage(locale: "en" | "nl") {
	return render(
		<LocaleProvider initialLocale={locale}>
			<ToastHost>
				<ConfirmDialogProvider>
					<Page />
				</ConfirmDialogProvider>
			</ToastHost>
		</LocaleProvider>,
	);
}

beforeEach(() => removeExercise.mockClear());

it("follows the language setting", () => {
	renderPage("nl");
	expect(screen.getByRole("heading", { name: "Oefeningenbibliotheek" }));
	expect(screen.getByText("2 oefeningen")).toBeTruthy();
	expect(screen.getByPlaceholderText("Zoek oefeningen…")).toBeTruthy();
	expect(screen.getByRole("button", { name: "Benen" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "Alle" })).toBeTruthy();
	expect(screen.getByLabelText("Filter op categorie")).toBeTruthy();
	expect(screen.getByLabelText("Filter op materiaal")).toBeTruthy();
	expect(screen.getByText("Halterstang · Samengesteld")).toBeTruthy();
	expect(screen.getAllByText("Borst").length).toBeGreaterThan(0);
	expect(screen.getByText("Voorste schouders")).toBeTruthy();
	expect(
		screen.getByRole("button", { name: "Verwijder Cable Fly" }),
	).toBeTruthy();
	expect(
		screen.getByRole("button", { name: "Oefening toevoegen" }),
	).toBeTruthy();
	expect(screen.queryByText("Exercise Library")).toBeNull();
});

it("asks before deleting a personal exercise, and Cancel keeps it", async () => {
	renderPage("en");
	fireEvent.click(screen.getByRole("button", { name: "Delete Cable Fly" }));
	expect(await screen.findByText("Delete Cable Fly?")).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
	await waitFor(() =>
		expect(screen.queryByText("Delete Cable Fly?")).toBeNull(),
	);
	expect(removeExercise).not.toHaveBeenCalled();
});

it("deletes after the named confirmation", async () => {
	renderPage("en");
	fireEvent.click(screen.getByRole("button", { name: "Delete Cable Fly" }));
	fireEvent.click(
		await screen.findByRole("button", { name: "Delete exercise" }),
	);
	await waitFor(() =>
		expect(removeExercise).toHaveBeenCalledWith({ id: "personal-1" }),
	);
});
