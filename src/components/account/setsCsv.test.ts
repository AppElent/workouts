import { expect, it } from "vitest";
import { csvCell, setsToCsv } from "./setsCsv";

it("quotes cells with a comma, quote, newline, or carriage return", () => {
	expect(csvCell("a,b")).toBe('"a,b"');
	expect(csvCell('say "hi"')).toBe('"say ""hi"""');
	expect(csvCell("a\nb")).toBe('"a\nb"');
	expect(csvCell("a\rb")).toBe('"a\rb"');
	expect(csvCell("plain")).toBe("plain");
	expect(csvCell(undefined)).toBe("");
	expect(csvCell(null)).toBe("");
});

it("prefixes text a spreadsheet could read as a formula", () => {
	expect(csvCell("=1+1")).toBe("'=1+1");
	expect(csvCell("+1")).toBe("'+1");
	expect(csvCell("-Push")).toBe("'-Push");
	expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
	expect(csvCell("\tx")).toBe("'\tx");
	expect(csvCell("\rx")).toBe(`"'\rx"`);
});

it("leaves numbers unchanged, negative ones included", () => {
	expect(csvCell(-5)).toBe("-5");
	expect(csvCell(-2.5)).toBe("-2.5");
	expect(csvCell(0)).toBe("0");
});

const set = (over: Record<string, unknown>) => ({
	_id: "s1",
	sessionId: "w1",
	exerciseId: "e1",
	setNumber: 1,
	setType: "working",
	weight: 100,
	unit: "kg",
	reps: 5,
	loggedAt: new Date(2026, 0, 2, 9, 30).getTime(),
	...over,
});

const tables = (sets: unknown[]) => ({
	sets,
	workoutSessions: [{ _id: "w1", name: "Push", date: 0 }],
});
const names = new Map([["e1", "Bench press"]]);

it("adds a notes column after rpe, empty when the set has none", () => {
	const [header, row] = setsToCsv(tables([set({})]), names).split("\n");
	expect(header).toBe(
		"date,session,exercise,setNumber,setType,weight,unit,reps,rpe,notes",
	);
	expect(row).toBe("2026-01-02 09:30,Push,Bench press,1,working,100,kg,5,,");
});

it("writes a note with a comma, quote, newline, carriage return, and leading =", () => {
	const note = '=hard, "felt" heavy\nsecond\rthird';
	const csv = setsToCsv(tables([set({ notes: note, rpe: 8 })]), names);
	expect(csv.split("\n").slice(1).join("\n")).toBe(
		`2026-01-02 09:30,Push,Bench press,1,working,100,kg,5,8,"'=hard, ""felt"" heavy\nsecond\rthird"`,
	);
});

it("guards a session or exercise name that starts with a trigger character", () => {
	const t = {
		sets: [set({})],
		workoutSessions: [{ _id: "w1", name: "-Push", date: 0 }],
	};
	const [, row] = setsToCsv(t, new Map([["e1", "=Bench"]])).split("\n");
	expect(row).toBe("2026-01-02 09:30,'-Push,'=Bench,1,working,100,kg,5,,");
});

it("keeps a negative weight numeric", () => {
	const [, row] = setsToCsv(tables([set({ weight: -20 })]), names).split("\n");
	expect(row).toBe("2026-01-02 09:30,Push,Bench press,1,working,-20,kg,5,,");
});
