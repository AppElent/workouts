import type { Doc } from "@convex/_generated/dataModel";
import type { Exercise } from "@foundry/core/exercises";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { SessionSummary } from "./SessionSummary";

vi.mock("convex/react", () => ({
	useMutation: () => vi.fn(),
	useQuery: () => [],
}));
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
	Link: ({ children }: { children: React.ReactNode }) => (
		<a href="/">{children}</a>
	),
}));
vi.mock("#/components/ui/confirm-dialog", () => ({
	useConfirm: () => vi.fn(),
}));
vi.mock("#/components/ui/toast", () => ({
	useToast: () => ({ error: vi.fn() }),
}));

afterEach(cleanup);

const exerciseId = "shipped:exercise:barbell-bench-press";
const session = {
	_id: "session-1",
	status: "completed",
	startTime: Date.UTC(2026, 10, 25, 18),
	endTime: Date.UTC(2026, 10, 25, 19),
} as Doc<"workoutSessions">;
const exerciseMap = new Map([
	[exerciseId, { _id: exerciseId, name: "Bench Press" } as unknown as Exercise],
]);

function set(id: string, weight: number, unit: "kg" | "lbs") {
	return {
		_id: id,
		exerciseId,
		setNumber: 1,
		reps: 5,
		weight,
		unit,
		setType: "working",
	} as Doc<"sets">;
}

it("labels each set chip with the set's own unit", () => {
	render(
		<LocaleProvider initialLocale="en">
			<SessionSummary
				session={session}
				sets={[set("a", 60, "kg"), set("b", 135, "lbs"), set("c", 0, "kg")]}
				exerciseMap={exerciseMap}
			/>
		</LocaleProvider>,
	);
	expect(screen.getByText(/1\. 60kg ×/)).toBeTruthy();
	expect(screen.getByText(/2\. 135lbs ×/)).toBeTruthy();
	expect(screen.getByText(/3\. BW ×/)).toBeTruthy();
	expect(screen.queryByText(/135kg/)).toBeNull();
});
