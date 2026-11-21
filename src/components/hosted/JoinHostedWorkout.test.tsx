// @vitest-environment jsdom
/** The join page speaks the viewer's language, not only the claim card. */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JoinHostedWorkout } from "#/components/hosted/JoinHostedWorkout";
import { type Locale, LocaleProvider } from "#/lib/i18n";

vi.mock("@clerk/react", () => ({
	useAuth: () => ({ isSignedIn: false }),
	useUser: () => ({ user: null }),
	Show: ({ when, children }: { when: string; children: React.ReactNode }) =>
		when === "signed-out" ? children : null,
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: React.ReactNode }) => (
		<a href="/">{children}</a>
	),
	useNavigate: () => vi.fn(),
}));

const wodBlock = {
	blockId: "wod-1",
	name: "Fran",
	type: "forTime",
	timeCapSeconds: 600,
	levels: [{ level: "rx", label: "", movements: [] }],
};

let status = "open";

vi.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
	useMutation: () => vi.fn(),
	useQuery: (_query: unknown, args: Record<string, unknown>) =>
		"guestKey" in args
			? []
			: {
					hosted: {
						title: "Friday WOD",
						status,
						template: {
							strengthBlocks: [{ blockId: "s-1", exerciseName: "Squat" }],
							wodBlocks: [wodBlock],
						},
					},
					submissions: [],
				},
}));

afterEach(() => {
	cleanup();
	status = "open";
});

function renderJoin(locale: Locale) {
	render(
		<LocaleProvider initialLocale={locale}>
			<JoinHostedWorkout token="abc" />
		</LocaleProvider>,
	);
}

describe("JoinHostedWorkout", () => {
	it("shows English copy for an English viewer", () => {
		renderJoin("en");
		expect(screen.getByText("Sign in to join")).toBeTruthy();
		expect(screen.getByText("Strength")).toBeTruthy();
		expect(screen.getByText("Guest name")).toBeTruthy();
		expect(screen.getByText("Time cap 10:00")).toBeTruthy();
		expect(screen.getByText("No scores yet.")).toBeTruthy();
	});

	it("shows Dutch copy for a Dutch viewer", () => {
		renderJoin("nl");
		expect(screen.getByText("Log in om mee te doen")).toBeTruthy();
		expect(screen.getByText("Kracht")).toBeTruthy();
		expect(screen.getByText("Gastnaam")).toBeTruthy();
		expect(screen.getByText("Tijdslimiet 10:00")).toBeTruthy();
		expect(screen.getByText("Nog geen scores.")).toBeTruthy();
		expect(screen.getByText("Open")).toBeTruthy();
		expect(screen.getByText("Op tijd")).toBeTruthy();
	});

	it("explains a closed workout in Dutch", () => {
		status = "closed";
		renderJoin("nl");
		expect(
			screen.getByText("Deze training is gesloten. De scores staan vast."),
		).toBeTruthy();
	});
});
