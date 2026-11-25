import type { Doc } from "@convex/_generated/dataModel";
import { isTimedExercise } from "@foundry/core";
import { format } from "date-fns";

/**
 * One CSV cell. Numbers are written as-is, so negative values stay numeric.
 * Text that a spreadsheet could read as a formula (`=`, `+`, `-`, `@`, tab, CR)
 * gets a leading `'` (OWASP CSV injection), so a name like "-Push" is written
 * as "'-Push" on purpose. Values with `,`, `"`, `\n` or `\r`
 * are quoted.
 */
export function csvCell(value: unknown): string {
	let s = value === undefined || value === null ? "" : String(value);
	if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
	return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
		"notes",
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
				s.notes ?? "",
			]
				.map(csvCell)
				.join(",");
		});
	return [header.join(","), ...rows].join("\n");
}
