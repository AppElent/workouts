import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { type Locale, LocaleProvider } from "#/lib/i18n";
import { ExportDataCard } from "./ExportDataCard";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("convex/react", () => ({
	useConvex: () => ({ query: mocks.query }),
}));
vi.mock("#/lib/exercises", () => ({ useExercises: () => [] }));

beforeEach(() => {
	mocks.query.mockReset();
});

function renderCard(locale: Locale) {
	render(
		<LocaleProvider initialLocale={locale}>
			<ExportDataCard />
		</LocaleProvider>,
	);
}

it("shows the export card in Dutch", () => {
	renderCard("nl");
	expect(
		screen.getByRole("heading", { name: "Je gegevens exporteren" }),
	).toBeTruthy();
	expect(screen.getByRole("button", { name: "Sets als CSV" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "Alles als JSON" })).toBeTruthy();
});

it("shows the catalog error when the export fails", async () => {
	mocks.query.mockRejectedValue({});
	renderCard("en");
	fireEvent.click(screen.getByRole("button", { name: "Full JSON" }));
	expect((await screen.findByRole("alert")).textContent).toBe(
		"The export could not be created. Reconnect and try again.",
	);
	expect(
		(screen.getByRole("button", { name: "Sets CSV" }) as HTMLButtonElement)
			.disabled,
	).toBe(false);
});
