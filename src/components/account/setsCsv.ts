import type { Doc } from "@convex/_generated/dataModel";
import { isTimedExercise } from "@foundry/core";
import { format } from "date-fns";

function csvCell(value: unknown): string {
	const s = value === undefined || value === null ? "" : String(value);
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function setsToCsv(
	tables: Record<string, unknown[]>,
	exerciseName: Map<string, string>,
): string {
	// personalPage rows are untyped (`v.any()`); these tables hold these documents.
	const sets = (tables.sets ?? []) as Doc<"sets">[];
	const sessions = (tables.workoutSessions ?? []) as Doc<"workoutSessions">[];
	const sessionName = new Map(
		sessions.map((s) => [
			s._id as string,
			s.name ?? format(new Date(s.date), "yyyy-MM-dd"),
		]),
	);
	const header = [
		"date",
		"session",
		"exercise",
		"setNumber",
		"setType",
		"weight",
		"unit",
		"reps",
		"seconds",
		"rpe",
	];
	const rows = [...sets]
		.sort((a, b) => a.loggedAt - b.loggedAt)
		.map((s) => {
			const timed = isTimedExercise(s.exerciseId);
			return [
				format(new Date(s.loggedAt), "yyyy-MM-dd HH:mm"),
				sessionName.get(s.sessionId) ?? "",
				exerciseName.get(s.exerciseId) ?? "",
				s.setNumber,
				s.setType,
				s.weight,
				s.unit,
				// A hold counts seconds in `reps`: label it so it never reads as reps.
				timed ? "" : s.reps,
				timed ? s.reps : "",
				s.rpe ?? "",
			]
				.map(csvCell)
				.join(",");
		});
	return [header.join(","), ...rows].join("\n");
}
