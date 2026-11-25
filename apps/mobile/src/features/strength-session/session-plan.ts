/**
 * The Strength Session plan: open sets, order, groups, rest default and local
 * 1RM overrides. Pure and device-local; logged sets stay owned by the server,
 * and the plan links to them through `setId`. See docs/contracts/training.md.
 *
 * Canonical load is kilograms. `typedLbs` keeps a pound value exactly as typed,
 * so a unit switch can never change what was entered.
 */
import {
	calculateOneRepMax,
	convertLoad,
	DEFAULT_REST_SECONDS,
	type Equipment,
	isReferenceEligible,
	type LoadUnit,
	roundLoad,
	type SetType,
	sessionOneRepMax,
	TIMED_DEFAULT_SECONDS,
	TIMED_LONG_HOLD_SECONDS,
	validateSetInput,
	workingVolume,
} from "@foundry/core";
import type { FunctionArgs } from "convex/server";
import type { api, Doc } from "../../convex/api";

export type GroupMode = "rounds" | "amrap";
type GroupState = "idle" | "running" | "timeup" | "closed";

/** A set as `sets.add` takes it, less the ids the session and the attempt supply. */
export type LogPayload = Omit<
	FunctionArgs<typeof api.sets.add>,
	"operationId" | "sessionId" | "exerciseId"
> & { exerciseId: string };
interface LogAttempt {
	operationId: string;
	setNumber: number;
	payload: LogPayload;
	/** True once a request left the device; its outcome may still be unknown. */
	sent: boolean;
}
interface PlanTarget {
	kg: number;
	reps: number;
	percent: number | null;
}
export interface PlanSet {
	id: string;
	exerciseId: string;
	kg: number;
	typedLbs?: number;
	reps: number;
	unit: LoadUnit;
	/** The percentage this set is priced at, when it has one. */
	percent: number | null;
	kind: SetType;
	rpe: number | null;
	/** As typed; saved trimmed. */
	notes?: string;
	/** On a draft of a logged set: its note was typed here. */
	notesEdited?: boolean;
	done: boolean;
	setId?: string;
	setNumber?: number;
	/** Frozen when logged. Null when no 1RM existed yet. */
	loggedPercent?: number | null;
	plan?: PlanTarget;
	free?: boolean;
	blank?: boolean;
	carried?: boolean;
	pricedKg?: number;
	/** What a free set started from, for typo guards after in-place edits. */
	baseline?: { kg: number; reps: number };
	basePlanKg?: number;
	lbStep?: boolean;
	/** Set before a swap, so swapping back restores the plan exactly. */
	orig?: { exerciseId: string; row: PlanSet };
	confirmedKey?: string;
	failed?: boolean;
	attempt?: LogAttempt;
	/** Set whose values someone changed here; kept across log/unlog; see `updateRow`. */
	edited?: boolean;
}
export interface GroupRound {
	id: string;
	partial?: boolean;
	items: PlanSet[];
}
export interface SetGroup {
	id: string;
	mode: GroupMode;
	state: GroupState;
	capMinutes: number;
	endsAt: number | null;
	stoppedRemaining: number | null;
	restSeconds: number;
	rounds: GroupRound[];
	savedRounds?: GroupRound[];
	lastRounds?: number;
}
export type OrderEntry =
	| { kind: "exercise"; exerciseId: string }
	| { kind: "group"; groupId: string };
export interface SessionPlan {
	version: 1;
	order: OrderEntry[];
	sets: Record<string, PlanSet[]>;
	groups: Record<string, SetGroup>;
	/** Number: manual override. Null: ignore the saved manual 1RM. */
	manual: Record<string, number | null>;
	removed: string[];
	lastFilled: string[];
	restDefault: number;
}

export interface ExerciseFacts {
	/** Unknown while the catalog loads or after the exercise was deleted. */
	exercise: { readonly equipment: Equipment } | null;
	bodyweight: boolean;
	/** A held time: the set's `reps` counts seconds (see `isTimedExercise`). */
	timed: boolean;
	stepKg: number;
	measured: number | null;
	estimated: number | null;
	savedManual: { value: number; date: number } | null;
	measuredDate: number | null;
	/** The last logged set of this exercise in another session. */
	last: {
		kg: number;
		reps: number;
		rpe?: number | null;
		/** When it was logged, epoch ms. */
		date?: number | null;
	} | null;
}
export type PlanFacts = (exerciseId: string) => ExerciseFacts;
export interface PlanNote {
	code: string;
	values?: Record<string, string | number>;
}
export interface PlanResult {
	plan: SessionPlan;
	note?: PlanNote;
	refused?: boolean;
}

const EPSILON = 0.01;
let counter = 0;
function newRowId() {
	counter += 1;
	return `r${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
const near = (a: number, b: number) => Math.abs(a - b) < EPSILON;
const round2 = (value: number) => Math.round(value * 100) / 100;

const LB_STEP = 5;
/** Lbs always step by 5 lb; kg by the exercise's own step. */
export function loadStep(unit: LoadUnit, stepKg: number) {
	return unit === "lbs" ? LB_STEP : stepKg;
}
const nearestLbStep = (kg: number) =>
	Math.round(convertLoad(kg, "kg", "lbs") / LB_STEP) * LB_STEP;
export function snapLoad(kg: number, stepKg: number, unit: LoadUnit = "kg") {
	if (unit === "lbs") return convertLoad(nearestLbStep(kg), "lbs", "kg");
	return roundLoad(kg, stepKg);
}
/** The number shown for a set, in the set's own unit. */
export function shownLoad(row: Pick<PlanSet, "kg" | "unit" | "typedLbs">) {
	if (row.unit === "kg") return round2(row.kg);
	if (
		row.typedLbs !== undefined &&
		near(convertLoad(row.typedLbs, "lbs", "kg"), row.kg)
	)
		return row.typedLbs;
	return Math.round(convertLoad(row.kg, "kg", "lbs") * 10) / 10;
}
export function withTypedLoad(row: PlanSet, value: number): PlanSet {
	if (row.unit === "lbs")
		return {
			...row,
			kg: convertLoad(value, "lbs", "kg"),
			typedLbs: value,
			lbStep: undefined,
		};
	return { ...row, kg: value, typedLbs: undefined, lbStep: undefined };
}
export function stepLoad(
	row: PlanSet,
	direction: 1 | -1,
	facts: ExerciseFacts,
): PlanSet {
	const floor = facts.bodyweight ? 0 : facts.stepKg;
	if (row.unit === "lbs") {
		const pounds = nearestLbStep(row.kg) + LB_STEP * direction;
		const kg = convertLoad(pounds, "lbs", "kg");
		return kg < floor - EPSILON
			? row
			: { ...row, kg, typedLbs: pounds, lbStep: true };
	}
	const kg = round2(row.kg + facts.stepKg * direction);
	return { ...row, kg: Math.max(floor, kg), typedLbs: undefined };
}
/** A unit switch only changes how a set reads. Its load stays what it was. */
export function switchUnit(
	row: PlanSet,
	unit: LoadUnit,
	facts: ExerciseFacts,
): PlanSet {
	if (row.unit === unit || facts.bodyweight) return row;
	if (unit === "kg" && row.lbStep && !row.done)
		return {
			...row,
			unit,
			kg: snapLoad(row.kg, facts.stepKg),
			typedLbs: undefined,
			lbStep: undefined,
		};
	return { ...row, unit };
}
export function isValidRow(row: PlanSet, facts: ExerciseFacts) {
	return (
		Number.isFinite(row.kg) &&
		Number.isInteger(row.reps) &&
		(facts.bodyweight ? row.kg >= 0 : row.kg > 0) &&
		row.reps >= (row.blank ? 1 : 0) &&
		validateSetInput({ weight: shownLoad(row), reps: row.reps }).ok
	);
}
export const noteOf = (row: Pick<PlanSet, "notes">) => row.notes?.trim() ?? "";
/**
 * A draft of a logged set with the note saving it would leave: one nobody typed
 * here stays the stored note, which may have changed elsewhere since.
 */
export function withStoredNote(draft: PlanSet, stored: PlanSet): PlanSet {
	return draft.notesEdited ? draft : { ...draft, notes: stored.notes };
}
export function payloadFor(row: PlanSet, setNumber: number): LogPayload {
	const notes = noteOf(row);
	return {
		exerciseId: row.exerciseId,
		setNumber,
		reps: row.reps,
		weight:
			row.unit === "lbs"
				? (row.typedLbs ??
					Math.round(convertLoad(row.kg, "kg", "lbs") * 1e6) / 1e6)
				: Math.round(row.kg * 1e6) / 1e6,
		unit: row.unit,
		...(row.rpe === null ? {} : { rpe: row.rpe }),
		...(notes ? { notes } : {}),
		setType: row.kind,
	};
}

export function referenceFor(
	plan: SessionPlan,
	facts: ExerciseFacts,
	exerciseId: string,
): StrengthReference | null {
	return referenceFromFacts(facts, plan.manual[exerciseId]);
}
export type StrengthReference = {
	value: number;
	source: "manual" | "measured";
};
/**
 * The 1RM percentages use: a session's own manual override (`local`), else
 * Measured unless a newer saved manual 1RM. `local === null` ignores the saved
 * manual; outside a session pass `undefined`.
 */
export function referenceFromFacts(
	facts: ExerciseFacts,
	local: number | null | undefined,
): StrengthReference | null {
	if (facts.bodyweight) return null;
	if (typeof local === "number") return { value: local, source: "manual" };
	const chosen = sessionOneRepMax({
		measured:
			facts.measured === null
				? null
				: { value: facts.measured, date: facts.measuredDate ?? 0 },
		estimated: null,
		manual: local === undefined ? facts.savedManual : null,
	});
	return chosen && { value: chosen.reference.value, source: chosen.kind };
}
/** What a person did but the server hasn't confirmed: never rewrite it. */
const isUnsaved = (row: PlanSet) => Boolean(row.failed || row.attempt);
export function targetPercent(
	row: PlanSet,
	reference: { value: number } | null,
	stepKg: number,
) {
	if (!reference || row.percent === null) return null;
	const exact = (reference.value * row.percent) / 100;
	return near(snapLoad(exact, stepKg, row.unit), row.kg) ||
		near(snapLoad(exact, stepKg), row.kg)
		? row.percent
		: null;
}
/**
 * The percentage the chips should show for a set: its planned one while the
 * weight still prices it, otherwise the weight's share of the 1RM to a tenth.
 */
export function chipPercentOf(
	row: Pick<PlanSet, "kg">,
	target: number | null,
	reference: { value: number } | null,
	bodyweight: boolean,
) {
	if (target !== null) return target;
	if (!reference || bodyweight || !(row.kg > 0) || !(reference.value > 0))
		return null;
	return Math.round((row.kg / reference.value) * 1000) / 10;
}
export function shownPercent(
	row: PlanSet,
	reference: { value: number } | null,
	stepKg: number,
) {
	if (row.done && typeof row.loggedPercent === "number")
		return row.loggedPercent;
	if (!reference || !(row.kg > 0)) return null;
	return (
		(row.done ? null : targetPercent(row, reference, stepKg)) ??
		Math.round((row.kg / reference.value) * 100)
	);
}
/** A set being logged now is verified, so only the server's reference rule decides. */
export function rowOneRepMax(
	row: Pick<PlanSet, "kg" | "reps">,
	facts: Pick<ExerciseFacts, "exercise">,
) {
	return isReferenceEligible(
		{ weight: row.kg, reps: row.reps, performanceVerified: true },
		facts.exercise,
	)
		? calculateOneRepMax(row.kg, row.reps)
		: null;
}

const groupRows = (group: SetGroup) => group.rounds.flatMap((r) => r.items);
export function allRows(plan: SessionPlan) {
	return [
		...Object.values(plan.sets).flat(),
		...Object.values(plan.groups).flatMap(groupRows),
	];
}
export function findRow(plan: SessionPlan, id: string) {
	return allRows(plan).find((row) => row.id === id);
}
export function rowsOf(plan: SessionPlan, exerciseId: string) {
	return allRows(plan).filter((row) => row.exerciseId === exerciseId);
}
export function groupOfRow(plan: SessionPlan, id: string) {
	return Object.values(plan.groups).find((group) =>
		groupRows(group).some((row) => row.id === id),
	);
}
export function groupOfExercise(plan: SessionPlan, exerciseId: string) {
	return Object.values(plan.groups).find((group) =>
		groupRows(group).some((row) => row.exerciseId === exerciseId),
	);
}
export const groupExercises = (group: SetGroup) => [
	...new Set(groupRows(group).map((row) => row.exerciseId)),
];
export function sessionExercises(plan: SessionPlan) {
	return plan.order.flatMap((entry) =>
		entry.kind === "exercise"
			? [entry.exerciseId]
			: plan.groups[entry.groupId]
				? groupExercises(plan.groups[entry.groupId] as SetGroup)
				: [],
	);
}
export function nextSetNumber(plan: SessionPlan, exerciseId: string) {
	return (
		rowsOf(plan, exerciseId).reduce(
			(max, row) =>
				Math.max(max, row.setNumber ?? 0, row.attempt?.setNumber ?? 0),
			0,
		) + 1
	);
}
/** The set the header, the table highlight and VoiceOver treat as next. */
export function nextOpenRow(plan: SessionPlan) {
	for (const entry of plan.order) {
		const rows =
			entry.kind === "exercise"
				? (plan.sets[entry.exerciseId] ?? [])
				: plan.groups[entry.groupId]
					? groupRows(plan.groups[entry.groupId] as SetGroup)
					: [];
		const open = rows.find((row) => !row.done);
		if (open) return open;
	}
	return undefined;
}
function mapRows(
	plan: SessionPlan,
	map: (row: PlanSet) => PlanSet,
): SessionPlan {
	return {
		...plan,
		sets: Object.fromEntries(
			Object.entries(plan.sets).map(([id, rows]) => [id, rows.map(map)]),
		),
		groups: Object.fromEntries(
			Object.entries(plan.groups).map(([id, group]) => [
				id,
				{
					...group,
					rounds: group.rounds.map((round) => ({
						...round,
						items: round.items.map(map),
					})),
					...(group.savedRounds
						? {
								savedRounds: group.savedRounds.map((round) => ({
									...round,
									items: round.items.map(map),
								})),
							}
						: {}),
				},
			]),
		),
	};
}
function replaceRow(plan: SessionPlan, id: string, next: PlanSet): SessionPlan {
	return mapRows(plan, (row) => (row.id === id ? next : row));
}

export type ServerSet = Pick<
	Doc<"sets">,
	"setNumber" | "reps" | "weight" | "unit" | "rpe" | "notes" | "setType"
> & { _id: string; exerciseId: string };
export type ServerExercise = {
	exerciseId: string;
	plannedSets: NonNullable<
		Doc<"workoutSessions">["exercises"]
	>[number]["plannedSets"];
};
function rowFromServer(set: ServerSet): PlanSet {
	return {
		id: newRowId(),
		exerciseId: set.exerciseId,
		kg: convertLoad(set.weight, set.unit, "kg"),
		...(set.unit === "lbs" ? { typedLbs: set.weight } : {}),
		reps: set.reps,
		unit: set.unit,
		percent: null,
		kind: set.setType,
		rpe: set.rpe ?? null,
		...(set.notes === undefined ? {} : { notes: set.notes }),
		done: true,
		setId: set._id,
		setNumber: set.setNumber,
	};
}
function plannedRow(
	plan: SessionPlan,
	exerciseId: string,
	planned: ServerExercise["plannedSets"][number],
	facts: ExerciseFacts,
): PlanSet {
	const kg = convertLoad(planned.weight, planned.unit, "kg");
	const reference = referenceFor(plan, facts, exerciseId);
	const guess =
		reference && kg > 0 ? Math.round((kg / reference.value) * 100) : null;
	const percent =
		guess !== null &&
		reference &&
		near(snapLoad((reference.value * guess) / 100, facts.stepKg), kg)
			? guess
			: null;
	return {
		id: newRowId(),
		exerciseId,
		kg,
		reps: planned.reps,
		unit: "kg",
		percent,
		kind: "working",
		rpe: null,
		done: false,
		plan: { kg, reps: planned.reps, percent },
		...(kg > 0 || facts.bodyweight ? {} : { blank: true }),
	};
}
export function emptyPlan(restDefault = DEFAULT_REST_SECONDS): SessionPlan {
	return {
		version: 1,
		order: [],
		sets: {},
		groups: {},
		manual: {},
		removed: [],
		lastFilled: [],
		restDefault,
	};
}
function seedExercise(
	plan: SessionPlan,
	exercise: ServerExercise,
	serverSets: ServerSet[],
	facts: ExerciseFacts,
): SessionPlan {
	const logged = serverSets
		.filter((set) => set.exerciseId === exercise.exerciseId)
		.sort((a, b) => a.setNumber - b.setNumber);
	return {
		...plan,
		order: [
			...plan.order,
			{ kind: "exercise", exerciseId: exercise.exerciseId },
		],
		sets: {
			...plan.sets,
			[exercise.exerciseId]: [
				...logged.map(rowFromServer),
				// Planned sets are working sets: a logged warm-up uses none of them.
				...exercise.plannedSets
					.slice(logged.filter((set) => set.setType !== "warmup").length)
					.map((planned) =>
						plannedRow(plan, exercise.exerciseId, planned, facts),
					),
			],
		},
	};
}
export function seedPlan(
	exercises: ServerExercise[],
	serverSets: ServerSet[],
	getFacts: PlanFacts,
	restDefault = DEFAULT_REST_SECONDS,
): SessionPlan {
	const known = new Set(exercises.map((item) => item.exerciseId));
	const extra = [...new Set(serverSets.map((set) => set.exerciseId))]
		.filter((id) => !known.has(id))
		.map((exerciseId) => ({ exerciseId, plannedSets: [] }));
	return [...exercises, ...extra].reduce(
		(plan, exercise) =>
			seedExercise(plan, exercise, serverSets, getFacts(exercise.exerciseId)),
		emptyPlan(restDefault),
	);
}
/**
 * Whether an open row moved from its plan, or a free row from the set it
 * copied. Also covers rows changed before `edited` was stored. A carried load
 * came from another set, not from input on this one.
 */
function offStart(row: PlanSet) {
	// A row with no start to compare, such as an unlogged warm-up, keeps its note too.
	if (noteOf(row) !== "") return true;
	const start =
		row.plan ??
		(row.baseline && { ...row.baseline, kg: row.pricedKg ?? row.baseline.kg });
	if (!start) return false;
	return (
		(!row.carried && !near(row.kg, start.kg)) ||
		row.reps !== start.reps ||
		row.rpe !== null ||
		Boolean(
			row.plan &&
				(row.kind !== "working" || (!row.carried && row.unit !== "kg")),
		)
	);
}
/**
 * Whether a set logged elsewhere may fill this row: an open one without input
 * from this device, and a warm-up only for a warm-up, since a logged warm-up
 * never uses up a planned working set.
 */
const fills = (row: PlanSet, set: ServerSet) =>
	row.exerciseId === set.exerciseId &&
	!row.done &&
	!row.edited &&
	!offStart(row) &&
	!isUnsaved(row) &&
	(row.kind === "warmup") === (set.setType === "warmup");
/** The logged set takes over the row but keeps its place and its target. */
function filledRow(row: PlanSet, set: ServerSet): PlanSet {
	return {
		...rowFromServer(set),
		id: row.id,
		...(row.plan ? { plan: row.plan } : {}),
	};
}
/**
 * A set logged elsewhere for a grouped exercise takes the place logging it here
 * would have: the first open set it may fill. With none, it joins the first
 * round that lacks the exercise, and only then a round of its own.
 */
function slotIntoGroup(group: SetGroup, set: ServerSet): SetGroup {
	const target = groupRows(group).find((row) => fills(row, set));
	if (target)
		return normalizeGroup({
			...group,
			rounds: group.rounds.map((round) => ({
				...round,
				items: round.items.map((row) =>
					row.id === target.id ? filledRow(row, set) : row,
				),
			})),
		});
	const logged = rowFromServer(set);
	const own = (row: PlanSet) => row.exerciseId === set.exerciseId;
	const gap = group.rounds.findIndex((round) => !round.items.some(own));
	if (gap >= 0)
		return normalizeGroup({
			...group,
			rounds: group.rounds.map((round, index) =>
				index === gap ? { ...round, items: [...round.items, logged] } : round,
			),
		});
	// Before a round still open here. An AMRAP copies its last round and counts
	// full ones, so there the extra round must be neither.
	const open = group.rounds.findIndex((round) =>
		round.items.some((row) => own(row) && !row.done),
	);
	const at = open < 0 ? group.rounds.length : open;
	const extra: GroupRound = {
		id: newRowId(),
		...(open >= 0 && group.mode === "amrap" ? { partial: true } : {}),
		items: [logged],
	};
	return normalizeGroup({
		...group,
		rounds: [...group.rounds.slice(0, at), extra, ...group.rounds.slice(at)],
	});
}
/** Server state wins for logged sets. Open sets and the session's shape stay local. */
export function reconcilePlan(
	plan: SessionPlan,
	exercises: ServerExercise[],
	serverSets: ServerSet[],
	getFacts: PlanFacts,
	/** Ids known to have reached this client; absent on a first reconcile. */
	seen?: ReadonlySet<string>,
): SessionPlan {
	const byId = new Map(serverSets.map((set) => [set._id, set]));
	const linked = new Set(
		allRows(plan).flatMap((row) => (row.setId ? [row.setId] : [])),
	);
	let changed = false;
	const syncRow = (row: PlanSet): PlanSet | null => {
		if (!row.setId) return row;
		const set = byId.get(row.setId);
		if (!set) {
			// A set this client just logged may be one render ahead of its query.
			if (seen && !seen.has(row.setId)) return row;
			changed = true;
			return null;
		}
		const kg = convertLoad(set.weight, set.unit, "kg");
		if (
			near(kg, row.kg) &&
			set.reps === row.reps &&
			set.unit === row.unit &&
			(set.rpe ?? null) === row.rpe &&
			(set.notes ?? "") === noteOf(row) &&
			set.setType === row.kind
		)
			return row;
		changed = true;
		return {
			...row,
			kg,
			typedLbs: set.unit === "lbs" ? set.weight : undefined,
			reps: set.reps,
			unit: set.unit,
			rpe: set.rpe ?? null,
			notes: set.notes,
			kind: set.setType,
		};
	};
	let next: SessionPlan = {
		...plan,
		sets: Object.fromEntries(
			Object.entries(plan.sets).map(([id, rows]) => [
				id,
				rows.flatMap((row) => {
					const synced = syncRow(row);
					return synced ? [synced] : [];
				}),
			]),
		),
		groups: Object.fromEntries(
			Object.entries(plan.groups).map(([id, group]) => [
				id,
				normalizeGroup({
					...group,
					rounds: group.rounds
						.map((round) => ({
							...round,
							items: round.items.flatMap((row) => {
								const synced = syncRow(row);
								return synced ? [synced] : [];
							}),
						}))
						.filter((round) => round.items.length > 0),
				}),
			]),
		),
	};
	// A set deleted elsewhere can take a group's last row of an exercise.
	for (const before of Object.values(plan.groups)) {
		const group = next.groups[before.id];
		if (group && groupExercises(group).length !== groupExercises(before).length)
			next = regroup(next, before, group);
	}
	for (const exercise of exercises) {
		const id = exercise.exerciseId;
		const present =
			next.order.some(
				(entry) => entry.kind === "exercise" && entry.exerciseId === id,
			) || groupOfExercise(next, id);
		if (present || next.removed.includes(id)) continue;
		changed = true;
		next = seedExercise(next, exercise, serverSets, getFacts(id));
		for (const set of serverSets)
			if (set.exerciseId === id) linked.add(set._id);
	}
	for (const set of serverSets) {
		if (linked.has(set._id)) continue;
		// The number of a set still being logged here: that set, or another
		// device's, even with equal values. Only its ack or receipt can tell.
		if (
			rowsOf(next, set.exerciseId).some(
				(row) => row.attempt?.setNumber === set.setNumber,
			)
		)
			continue;
		changed = true;
		linked.add(set._id);
		const home = groupOfExercise(next, set.exerciseId);
		if (home) {
			next = {
				...next,
				groups: { ...next.groups, [home.id]: slotIntoGroup(home, set) },
			};
			continue;
		}
		if (
			!next.order.some(
				(entry) =>
					entry.kind === "exercise" && entry.exerciseId === set.exerciseId,
			)
		)
			next = {
				...next,
				order: [
					...next.order,
					{ kind: "exercise", exerciseId: set.exerciseId },
				],
				removed: next.removed.filter((id) => id !== set.exerciseId),
			};
		const rows = next.sets[set.exerciseId] ?? [];
		// The first row it may fill, not the one at its set number: MCP callers
		// count sets their own way, and two devices can use the same number.
		const target = rows.find((row) => fills(row, set));
		const firstOpen = rows.findIndex((row) => !row.done);
		const at = firstOpen < 0 ? rows.length : firstOpen;
		next = {
			...next,
			sets: {
				...next.sets,
				[set.exerciseId]: target
					? rows.map((row) => (row === target ? filledRow(row, set) : row))
					: [...rows.slice(0, at), rowFromServer(set), ...rows.slice(at)],
			},
		};
	}
	return changed ? next : plan;
}
/** Fills rows the plan left without a load, once last time's result is known. */
export function fillFromLast(
	plan: SessionPlan,
	exerciseId: string,
	facts: ExerciseFacts,
): SessionPlan {
	if (plan.lastFilled.includes(exerciseId)) return plan;
	const last = facts.last;
	const fill = (row: PlanSet): PlanSet => {
		if (
			row.exerciseId !== exerciseId ||
			row.done ||
			isUnsaved(row) ||
			!last ||
			row.kg > 0
		)
			return row;
		const reps = row.reps >= 1 ? row.reps : last.reps;
		return {
			...row,
			kg: last.kg,
			reps,
			blank: undefined,
			...(row.plan ? { plan: { ...row.plan, kg: last.kg, reps } } : {}),
		};
	};
	return {
		...mapRows(plan, fill),
		lastFilled: [...plan.lastFilled, exerciseId],
	};
}

function setBlank(
	exerciseId: string,
	facts: Pick<ExerciseFacts, "last" | "timed">,
): PlanSet {
	const last = facts.last;
	return {
		id: newRowId(),
		exerciseId,
		kg: last?.kg ?? 0,
		reps: last?.reps ?? (facts.timed ? TIMED_DEFAULT_SECONDS : 0),
		unit: "kg",
		percent: null,
		kind: "working",
		rpe: null,
		done: false,
		free: true,
		...(last
			? { pricedKg: last.kg, baseline: { kg: last.kg, reps: last.reps } }
			: { blank: true }),
	};
}
const repsNext = (row: PlanSet) =>
	row.reps >= 1 ? row.reps : row.plan && row.plan.reps >= 1 ? row.plan.reps : 5;
function freshCopy(row: PlanSet): PlanSet {
	const unknownReps = Boolean(row.blank && row.reps < 1);
	return {
		id: newRowId(),
		exerciseId: row.exerciseId,
		kg: row.kg,
		...(row.typedLbs === undefined ? {} : { typedLbs: row.typedLbs }),
		reps: unknownReps ? 0 : repsNext(row),
		unit: row.unit,
		percent: row.plan ? null : row.percent,
		kind: row.kind,
		rpe: null,
		done: false,
		free: true,
		pricedKg: row.kg,
		baseline: { kg: row.kg, reps: unknownReps ? 0 : repsNext(row) },
		...(unknownReps ? { blank: true } : {}),
	};
}
/** Stores a row, noting when that changes a set's values. */
export function updateRow(
	plan: SessionPlan,
	id: string,
	next: PlanSet,
): SessionPlan {
	const stored = findRow(plan, id);
	if (!stored || stored.done !== next.done || sameSet(stored, next))
		return replaceRow(plan, id, next);
	const onPlan = next.plan && !next.carried && !offStart(next);
	return replaceRow(plan, id, { ...next, edited: onPlan ? undefined : true });
}
/** A percentage chip prices the set; it does not touch reps. */
export function applyPercent(
	row: PlanSet,
	percent: number,
	reference: { value: number },
	facts: ExerciseFacts,
): PlanSet {
	const kg = snapLoad(
		(reference.value * percent) / 100,
		facts.stepKg,
		row.unit,
	);
	return {
		...row,
		kg,
		percent,
		typedLbs:
			row.unit === "lbs" ? Math.round(convertLoad(kg, "kg", "lbs")) : undefined,
		blank: row.reps >= 1 ? undefined : row.blank,
	};
}
export function resetToPlan(row: PlanSet): PlanSet {
	return row.plan
		? {
				...row,
				kg: row.plan.kg,
				reps: row.plan.reps,
				percent: row.plan.percent,
				typedLbs: undefined,
				lbStep: undefined,
				confirmedKey: undefined,
			}
		: row;
}
/**
 * Once a free exercise (the last in the session, nothing planned) has no open
 * set left, the set the session offers next: one more like its last work set.
 * Planned exercises don't get extra sets offered. The row is the template, a
 * logged row; callers must not change it.
 */
export function repeatSetOf(
	plan: SessionPlan,
): { template: PlanSet; number: number } | null {
	if (runningGroup(plan)) return null;
	const entry = plan.order.at(-1);
	if (entry?.kind !== "exercise") return null;
	const rows = plan.sets[entry.exerciseId] ?? [];
	if (!rows.some((row) => row.done) || rows.some((row) => row.plan))
		return null;
	const template = addSetTemplate(rows);
	if (!template) return null;
	return {
		template,
		number: rows.filter((row) => row.kind !== "warmup").length + 1,
	};
}
/** A new set repeats the last work set, not a trailing warm-up. */
export function addSetTemplate(rows: PlanSet[]): PlanSet | undefined {
	return rows.findLast((row) => row.kind !== "warmup") ?? rows.at(-1);
}
export function addSet(
	plan: SessionPlan,
	exerciseId: string,
	facts: ExerciseFacts,
): PlanResult & { rowId: string } {
	const rows = plan.sets[exerciseId] ?? [];
	const last = addSetTemplate(rows);
	const fresh: PlanSet = last
		? { ...freshCopy(last), kind: "working" }
		: setBlank(exerciseId, facts);
	return {
		plan: {
			...plan,
			sets: { ...plan.sets, [exerciseId]: [...rows, fresh] },
		},
		rowId: fresh.id,
	};
}
/** Warm-ups go before the first open set, at half the first work set. */
export function addWarmup(
	plan: SessionPlan,
	exerciseId: string,
	facts: ExerciseFacts,
): PlanResult & { rowId: string } {
	const rows = plan.sets[exerciseId] ?? [];
	const work =
		rows.find((row) => !row.done && row.kind !== "warmup" && row.kg > 0) ??
		rows.find((row) => row.kg > 0);
	const kg = work
		? Math.max(facts.stepKg, snapLoad(work.kg / 2, facts.stepKg))
		: 0;
	const fresh: PlanSet = {
		id: newRowId(),
		exerciseId,
		kg,
		reps: 5,
		unit: "kg",
		percent: null,
		kind: "warmup",
		rpe: null,
		done: false,
		free: true,
		...(kg > 0 ? {} : { blank: true }),
	};
	const firstOpen = rows.findIndex((row) => !row.done);
	const at = firstOpen < 0 ? rows.length : firstOpen;
	return {
		plan: {
			...plan,
			sets: {
				...plan.sets,
				[exerciseId]: [...rows.slice(0, at), fresh, ...rows.slice(at)],
			},
		},
		rowId: fresh.id,
		note: { code: "warmupAdded" },
	};
}
/** A repeat lands after every logged set of its exercise, without renumbering. */
export function repeatRow(plan: SessionPlan, id: string): PlanResult {
	const row = findRow(plan, id);
	if (!row) return { plan };
	const rows = plan.sets[row.exerciseId];
	if (!rows?.some((item) => item.id === id))
		return { plan, refused: true, note: { code: "repeatInGroup" } };
	if (row.blank && row.reps < 1)
		return { plan, refused: true, note: { code: "repeatBlank" } };
	const fresh = freshCopy(row);
	const at = rows.reduce(
		(max, item, index) => (item.done && index > max ? index : max),
		rows.findIndex((item) => item.id === id),
	);
	return {
		plan: {
			...plan,
			sets: {
				...plan.sets,
				[row.exerciseId]: [
					...rows.slice(0, at + 1),
					fresh,
					...rows.slice(at + 1),
				],
			},
		},
		note: { code: "repeated" },
	};
}
/** Empties a slot, and dissolves a group that no longer has two exercises. */
export function removeRow(plan: SessionPlan, id: string): SessionPlan {
	const group = groupOfRow(plan, id);
	if (!group)
		return {
			...plan,
			sets: Object.fromEntries(
				Object.entries(plan.sets).map(([key, rows]) => [
					key,
					rows.filter((row) => row.id !== id),
				]),
			),
		};
	return regroup(plan, group, {
		...group,
		rounds: group.rounds
			.map((round) => ({
				...round,
				items: round.items.filter((row) => row.id !== id),
			}))
			.filter((round) => round.items.length > 0),
	});
}
export function moveEntry(
	plan: SessionPlan,
	entry: OrderEntry,
	delta: 1 | -1,
): SessionPlan {
	const at = plan.order.findIndex((item) => sameEntry(item, entry));
	const to = at + delta;
	if (at < 0 || to < 0 || to >= plan.order.length) return plan;
	const order = [...plan.order];
	[order[at], order[to]] = [order[to] as OrderEntry, order[at] as OrderEntry];
	return { ...plan, order };
}
/**
 * Makes an exercise the current one: its entry moves to just before the
 * entry that holds the next open set, so the Now card, the highlight and the
 * Live Activity all follow it. Done entries keep their place.
 */
export function focusExercise(
	plan: SessionPlan,
	exerciseId: string,
): SessionPlan {
	const from = plan.order.findIndex(
		(item) => item.kind === "exercise" && item.exerciseId === exerciseId,
	);
	if (from < 0) return plan;
	if (!(plan.sets[exerciseId] ?? []).some((row) => !row.done)) return plan;
	const next = nextOpenRow(plan);
	if (!next || next.exerciseId === exerciseId) return plan;
	const current = plan.order.findIndex((item) =>
		item.kind === "exercise"
			? item.exerciseId === next.exerciseId && !groupOfRow(plan, next.id)
			: (plan.groups[item.groupId]?.rounds ?? []).some((round) =>
					round.items.some((row) => row.id === next.id),
				),
	);
	if (current < 0 || current > from) return plan;
	const order = [...plan.order];
	const [entry] = order.splice(from, 1);
	order.splice(current, 0, entry as OrderEntry);
	return { ...plan, order };
}
const sameEntry = (a: OrderEntry, b: OrderEntry) =>
	a.kind === "exercise"
		? b.kind === "exercise" && a.exerciseId === b.exerciseId
		: b.kind === "group" && a.groupId === b.groupId;
export function addExerciseToPlan(
	plan: SessionPlan,
	exerciseId: string,
	facts: ExerciseFacts,
): PlanResult & { rowId?: string } {
	if (sessionExercises(plan).includes(exerciseId))
		return {
			plan,
			refused: true,
			note: { code: "alreadyInSession" },
		};
	const first = setBlank(exerciseId, facts);
	return {
		plan: {
			...plan,
			order: [...plan.order, { kind: "exercise", exerciseId }],
			sets: { ...plan.sets, [exerciseId]: [first] },
			removed: plan.removed.filter((id) => id !== exerciseId),
		},
		rowId: first.id,
	};
}
/** The logged sets this removes are returned so the server can delete them too. */
export function removeExercise(
	plan: SessionPlan,
	exerciseId: string,
): PlanResult & { setIds: string[] } {
	const setIds = rowsOf(plan, exerciseId).flatMap((row) =>
		row.setId ? [row.setId] : [],
	);
	const group = groupOfExercise(plan, exerciseId);
	if (group?.state === "running")
		return {
			plan,
			setIds: [],
			refused: true,
			note: { code: "stopClockFirst" },
		};
	const { [exerciseId]: _gone, ...sets } = plan.sets;
	const base: SessionPlan = {
		...plan,
		sets,
		order: plan.order.filter(
			(entry) =>
				!(entry.kind === "exercise" && entry.exerciseId === exerciseId),
		),
		removed: [...new Set([...plan.removed, exerciseId])],
	};
	const next = group
		? settleGroup(base, {
				...group,
				rounds: group.rounds
					.map((round) => ({
						...round,
						items: round.items.filter((row) => row.exerciseId !== exerciseId),
					}))
					.filter((round) => round.items.length > 0),
			})
		: base;
	return { plan: next, setIds, note: { code: "exerciseRemoved" } };
}

export interface TypoCheck {
	kind: "reps" | "kg";
	code: string;
	values: Record<string, number>;
}
export const confirmKey = (row: Pick<PlanSet, "kg" | "reps">) =>
	`${Math.round(row.kg * 1000)}x${row.reps}`;
/** Best 1RM values known for an exercise, optionally ignoring one set. */
export function bestKnown(
	plan: SessionPlan,
	exerciseId: string,
	facts: ExerciseFacts,
	exceptId?: string,
) {
	const today = bestToday(plan, exerciseId, facts, exceptId);
	const max = (a: number | null, b: number | null) =>
		a === null ? b : b === null ? a : Math.max(a, b);
	return {
		measured: max(facts.measured, today.measured),
		estimated: max(facts.estimated, today.estimated),
	};
}
export function bestToday(
	plan: SessionPlan,
	exerciseId: string,
	facts: ExerciseFacts,
	exceptId?: string,
) {
	let measured: number | null = null;
	let estimated: number | null = null;
	for (const row of rowsOf(plan, exerciseId)) {
		if (!row.done || row.id === exceptId) continue;
		const rm = rowOneRepMax(row, facts);
		if (!rm) continue;
		if (row.reps === 1) measured = Math.max(measured ?? 0, rm.value);
		else estimated = Math.max(estimated ?? 0, rm.value);
	}
	return { measured, estimated };
}
export function typoCheck(
	plan: SessionPlan,
	row: PlanSet,
	facts: ExerciseFacts,
	stored?: PlanSet,
): TypoCheck | null {
	if (row.confirmedKey === confirmKey(row) || row.reps < 1) return null;
	const base = stored?.done ? stored : (row.plan ?? row.baseline ?? row);
	const baseKg = base.kg;
	const baseReps = base.reps;
	const free = Boolean(row.free);
	// A hold's seconds would trip every rep-count check; only a very long hold asks.
	if (facts.timed) {
		if (row.reps > TIMED_LONG_HOLD_SECONDS)
			return { kind: "reps", code: "holdLong", values: { reps: row.reps } };
	} else {
		if (row.reps > 30)
			return { kind: "reps", code: "repsHigh", values: { reps: row.reps } };
		if (
			row.kind !== "failure" &&
			row.reps > 10 &&
			baseReps >= 1 &&
			row.reps > baseReps * 2
		)
			return {
				kind: "reps",
				code: free ? "repsAbovePrevious" : "repsAbovePlan",
				values: { reps: row.reps, base: baseReps },
			};
	}
	if (facts.bodyweight)
		return row.kg > Math.max(baseKg * 1.25, 50)
			? { kind: "kg", code: "addedHigh", values: { kg: row.kg } }
			: null;
	const known = bestKnown(plan, row.exerciseId, facts, row.id);
	const manual = referenceFor(plan, facts, row.exerciseId);
	const manualValue = manual?.source === "manual" ? manual.value : 0;
	if (
		row.reps === 1 &&
		row.kind !== "warmup" &&
		known.measured === null &&
		Math.max(known.estimated ?? 0, manualValue) > 0 &&
		row.kg < Math.max(known.estimated ?? 0, manualValue) * 0.85
	)
		return {
			kind: "kg",
			code: "singleLow",
			values: { top: Math.max(known.estimated ?? 0, manualValue) },
		};
	if (
		row.reps === 1 &&
		known.measured !== null &&
		row.kg > known.measured * 1.1
	)
		return {
			kind: "kg",
			code: "singleHigh",
			values: {
				percent: Math.round((row.kg / known.measured - 1) * 100),
				top: known.measured,
			},
		};
	const low: TypoCheck | null =
		row.kind !== "warmup" && baseKg > 0 && row.kg < baseKg * 0.5
			? {
					kind: "kg",
					code: free ? "belowPrevious" : "belowPlan",
					values: { percent: Math.round((1 - row.kg / baseKg) * 100) },
				}
			: null;
	if (row.reps === 1 && known.measured !== null) return low;
	const top = Math.max(known.estimated ?? 0, known.measured ?? 0, manualValue);
	const implied =
		row.reps >= 1 && row.kg > 0
			? calculateOneRepMax(row.kg, row.reps).value
			: 0;
	if (top > 0 && implied > top * 1.25)
		return {
			kind: "kg",
			code: "impliedHigh",
			values: { implied: Math.round(implied), top: Math.round(top) },
		};
	if (low) return low;
	if (baseKg > 0 && row.kg > baseKg * 1.25)
		return {
			kind: "kg",
			code: free ? "abovePrevious" : "abovePlan",
			values: { percent: Math.round((row.kg / baseKg - 1) * 100) },
		};
	return null;
}
export function manualIsOdd(
	plan: SessionPlan,
	exerciseId: string,
	value: number,
	facts: ExerciseFacts,
) {
	const known = bestKnown(plan, exerciseId, facts);
	const top = Math.max(known.measured ?? 0, known.estimated ?? 0);
	return top > 0 && (value > top * 1.25 || value < top * 0.5);
}

function repriced(
	plan: SessionPlan,
	exerciseId: string,
	value: number,
	facts: ExerciseFacts,
) {
	const old = referenceFor(plan, facts, exerciseId);
	const onPlan = (row: PlanSet) =>
		row.exerciseId === exerciseId &&
		!row.done &&
		!isUnsaved(row) &&
		row.percent !== null &&
		(!row.plan || near(row.kg, row.plan.kg)) &&
		(old
			? targetPercent(row, old, facts.stepKg) === row.percent
			: !row.free ||
				(row.pricedKg !== undefined && near(row.kg, row.pricedKg)));
	let moved = 0;
	const next = mapRows(plan, (row) => {
		if (
			row.exerciseId === exerciseId &&
			row.done &&
			row.loggedPercent == null &&
			old
		)
			return {
				...row,
				loggedPercent: Math.round((row.kg / old.value) * 100),
			};
		if (onPlan(row)) {
			const kg = snapLoad(
				(value * (row.percent as number)) / 100,
				facts.stepKg,
				row.unit,
			);
			if (!near(kg, row.kg)) moved += 1;
			return {
				...row,
				kg,
				typedLbs: undefined,
				blank: row.reps >= 1 ? undefined : row.blank,
				basePlanKg: row.basePlanKg ?? row.kg,
				...(row.plan ? { plan: { ...row.plan, kg } } : {}),
				...(row.pricedKg === undefined ? {} : { pricedKg: kg }),
			};
		}
		if (
			row.exerciseId === exerciseId &&
			!row.done &&
			row.plan &&
			row.plan.percent !== null
		)
			return {
				...row,
				plan: {
					...row.plan,
					kg: snapLoad(
						(value * row.plan.percent) / 100,
						facts.stepKg,
						row.unit,
					),
				},
			};
		return row;
	});
	return { next, moved };
}
export function setManual(
	plan: SessionPlan,
	exerciseId: string,
	value: number,
	facts: ExerciseFacts,
): PlanResult {
	const { next, moved } = repriced(plan, exerciseId, value, facts);
	return {
		plan: { ...next, manual: { ...next.manual, [exerciseId]: value } },
		note: moved
			? {
					code: "repriced",
					values: { count: moved, value },
				}
			: { code: "manualSaved", values: { value } },
	};
}
export function clearManual(
	plan: SessionPlan,
	exerciseId: string,
	facts: ExerciseFacts,
): PlanResult {
	const measured = facts.measured;
	if (measured !== null) {
		const { next } = repriced(plan, exerciseId, measured, facts);
		return {
			plan: { ...next, manual: { ...next.manual, [exerciseId]: null } },
			note: { code: "manualClearedMeasured", values: { value: measured } },
		};
	}
	const old = referenceFor(plan, facts, exerciseId);
	return {
		plan: {
			...mapRows(plan, (row) => {
				if (row.exerciseId !== exerciseId) return row;
				if (row.done) return { ...row, loggedPercent: null };
				return !isUnsaved(row) &&
					row.basePlanKg !== undefined &&
					(!old || targetPercent(row, old, facts.stepKg) === row.percent)
					? {
							...row,
							kg: row.basePlanKg,
							basePlanKg: undefined,
							...(row.plan
								? { plan: { ...row.plan, kg: row.basePlanKg } }
								: {}),
						}
					: row;
			}),
			manual: { ...plan.manual, [exerciseId]: null },
		},
		note: { code: "manualCleared" },
	};
}
/** Manual values still to save on the server when the session ends. */
export function pendingManuals(plan: SessionPlan) {
	return Object.entries(plan.manual).flatMap(([exerciseId, value]) =>
		typeof value === "number" ? [{ exerciseId, value }] : [],
	);
}

export function canSwap(plan: SessionPlan, from: string, to: string) {
	if (from === to) return { ok: false, code: "swapSame" };
	const present = sessionExercises(plan).includes(to);
	if (!present) return { ok: true };
	const hasOpen = rowsOf(plan, to).some((row) => !row.done);
	const grouped = Boolean(
		groupOfExercise(plan, to) || groupOfExercise(plan, from),
	);
	return hasOpen || grouped ? { ok: false, code: "swapHasOpen" } : { ok: true };
}
function swapWork(
	row: PlanSet,
	to: string,
	reference: { value: number } | null,
	facts: ExerciseFacts,
): PlanSet {
	const byPercent = Boolean(reference) && row.percent !== null;
	const keepPlan = !facts.bodyweight && !reference && row.percent !== null;
	const unit: LoadUnit = facts.bodyweight ? "kg" : row.unit;
	const kg = byPercent
		? snapLoad(
				((reference as { value: number }).value * (row.percent as number)) /
					100,
				facts.stepKg,
				unit,
			)
		: (facts.last?.kg ?? 0);
	const reps = byPercent || keepPlan ? row.reps : (facts.last?.reps ?? 0);
	return {
		id: row.id,
		exerciseId: to,
		kg,
		reps,
		unit,
		percent: byPercent || keepPlan ? row.percent : null,
		kind: row.kind === "warmup" ? "working" : row.kind,
		rpe: null,
		done: false,
		free: true,
		...(keepPlan ? { pricedKg: kg } : {}),
		...(reps < 1 || !(kg > 0 || facts.bodyweight) ? { blank: true } : {}),
	};
}
export function swapExercise(
	plan: SessionPlan,
	from: string,
	to: string,
	facts: ExerciseFacts,
): PlanResult {
	const check = canSwap(plan, from, to);
	if (!check.ok)
		return { plan, refused: true, note: { code: check.code as string } };
	const reference = referenceFor(plan, facts, to);
	const open = rowsOf(plan, from).filter((row) => !row.done);
	const firstWork = open.find((row) => row.kind !== "warmup");
	const workKg = firstWork ? swapWork(firstWork, to, reference, facts).kg : 0;
	const swapOne = (row: PlanSet): PlanSet => {
		if (row.orig?.exerciseId === to)
			return { ...row.orig.row, id: row.id, rpe: null };
		const orig = row.orig ?? { exerciseId: row.exerciseId, row };
		// What someone entered stays theirs: no set logged elsewhere may fill it.
		const edited = row.edited || offStart(row) ? { edited: true } : {};
		if (row.kind !== "warmup" || facts.bodyweight)
			return { ...swapWork(row, to, reference, facts), orig, ...edited };
		const kg =
			workKg > 0
				? Math.max(facts.stepKg, snapLoad(workKg / 2, facts.stepKg, row.unit))
				: 0;
		return {
			id: row.id,
			exerciseId: to,
			kg,
			reps: row.reps,
			unit: row.unit,
			percent: null,
			kind: "warmup",
			rpe: null,
			done: false,
			free: true,
			orig,
			...edited,
			...(kg > 0 ? {} : { blank: true }),
		};
	};
	const moved = open.map(swapOne);
	const movedById = new Map(moved.map((row) => [row.id, row]));
	const group = groupOfExercise(plan, from);
	let next: SessionPlan;
	if (group) {
		next = {
			...plan,
			groups: {
				...plan.groups,
				[group.id]: {
					...group,
					rounds: group.rounds.map((round) => ({
						...round,
						items: round.items.map((row) => movedById.get(row.id) ?? row),
					})),
				},
			},
			removed: plan.removed.filter((id) => id !== to),
		};
	} else {
		const kept = (plan.sets[from] ?? []).filter((row) => row.done);
		const target = plan.sets[to] ?? [];
		const sets: Record<string, PlanSet[]> = {
			...plan.sets,
			[to]: [...target, ...moved],
		};
		const at = plan.order.findIndex(
			(entry) => entry.kind === "exercise" && entry.exerciseId === from,
		);
		let order = plan.order;
		const hasTarget = order.some(
			(entry) => entry.kind === "exercise" && entry.exerciseId === to,
		);
		if (kept.length) {
			sets[from] = kept;
			if (!hasTarget)
				order = [
					...order.slice(0, at + 1),
					{ kind: "exercise", exerciseId: to },
					...order.slice(at + 1),
				];
		} else {
			delete sets[from];
			order = hasTarget
				? order.filter(
						(entry) =>
							!(entry.kind === "exercise" && entry.exerciseId === from),
					)
				: order.map((entry) =>
						entry.kind === "exercise" && entry.exerciseId === from
							? { kind: "exercise" as const, exerciseId: to }
							: entry,
					);
		}
		next = {
			...plan,
			sets,
			order,
			removed: [
				...new Set([
					...plan.removed.filter((id) => id !== to),
					...(kept.length ? [] : [from]),
				]),
			],
		};
	}
	const needsLoad = moved.some((row) => !(row.kg > 0) && !facts.bodyweight);
	const needsReps = moved.some((row) => row.reps < 1);
	const keptPlan =
		!facts.bodyweight &&
		!reference &&
		moved.some((row) => row.percent !== null && !row.blank);
	return {
		plan: next,
		note: {
			code: needsLoad
				? needsReps
					? "swapNeedsBoth"
					: "swapNeedsLoad"
				: needsReps
					? "swapNeedsReps"
					: keptPlan
						? "swapLastFilled"
						: "swapped",
		},
	};
}

const DEFAULT_GROUP_REST = 90;
const DEFAULT_CAP_MINUTES = 10;
const isRoundComplete = (round: GroupRound) =>
	round.items.every((row) => row.done);
const hasLogged = (round: GroupRound) => round.items.some((row) => row.done);
function cloneOpen(row: PlanSet): PlanSet {
	return {
		...freshCopy(row),
		orig: undefined,
		carried: undefined,
	};
}
function normalizeGroup(group: SetGroup): SetGroup {
	if (group.mode !== "amrap" || group.state === "closed") return group;
	const at = group.rounds.findIndex((round) => !isRoundComplete(round));
	if (at === -1) {
		if (group.state === "timeup") return group;
		const last = group.rounds[group.rounds.length - 1];
		if (!last) return group;
		return {
			...group,
			rounds: [
				...group.rounds,
				{ id: newRowId(), items: last.items.map(cloneOpen) },
			],
		};
	}
	return {
		...group,
		rounds: group.rounds.filter(
			(round, index) =>
				index <= at || hasLogged(round) || round.items.some(isUnsaved),
		),
	};
}
function buildRounds(lists: PlanSet[][]): GroupRound[] {
	const size = Math.max(...lists.map((list) => list.length));
	return Array.from({ length: size }, (_, index) => ({
		id: newRowId(),
		items: lists.flatMap((list) => {
			const own = list[index];
			if (own) return [own];
			const last = list[list.length - 1];
			return last && list.some((row) => !row.done) ? [cloneOpen(last)] : [];
		}),
	})).filter((round) => round.items.length > 0);
}
/** A group member needs a row: an exercise without sets gets one empty set. */
function memberRows(
	plan: SessionPlan,
	exerciseId: string,
	getFacts?: PlanFacts,
): PlanSet[] {
	const rows = plan.sets[exerciseId] ?? [];
	return rows.length
		? rows
		: [
				setBlank(
					exerciseId,
					getFacts?.(exerciseId) ?? { last: null, timed: false },
				),
			];
}
const orderIndex = (plan: SessionPlan, exerciseId: string) =>
	plan.order.findIndex(
		(entry) => entry.kind === "exercise" && entry.exerciseId === exerciseId,
	);
export function groupWith(
	plan: SessionPlan,
	a: string,
	b: string,
	getFacts?: PlanFacts,
): PlanResult & { groupId?: string } {
	if (groupOfExercise(plan, a) || groupOfExercise(plan, b))
		return { plan, refused: true, note: { code: "alreadyGrouped" } };
	// The group lists its exercises in the order the session showed them.
	const [first, second] =
		orderIndex(plan, b) < orderIndex(plan, a) ? [b, a] : [a, b];
	const before =
		(plan.sets[first]?.length ?? 0) + (plan.sets[second]?.length ?? 0);
	const rounds = buildRounds([
		memberRows(plan, first, getFacts),
		memberRows(plan, second, getFacts),
	]);
	const after = rounds.reduce((sum, round) => sum + round.items.length, 0);
	const id = newRowId();
	const { [first]: _a, [second]: _b, ...sets } = plan.sets;
	const position = Math.min(orderIndex(plan, first), orderIndex(plan, second));
	const left = plan.order.filter(
		(entry) =>
			!(
				entry.kind === "exercise" &&
				(entry.exerciseId === first || entry.exerciseId === second)
			),
	);
	return {
		plan: {
			...plan,
			sets,
			groups: {
				...plan.groups,
				[id]: {
					id,
					mode: "rounds",
					state: "idle",
					capMinutes: DEFAULT_CAP_MINUTES,
					endsAt: null,
					stoppedRemaining: null,
					restSeconds: DEFAULT_GROUP_REST,
					rounds,
				},
			},
			order: [
				...left.slice(0, Math.max(position, 0)),
				{ kind: "group", groupId: id },
				...left.slice(Math.max(position, 0)),
			],
		},
		groupId: id,
		note: {
			code:
				after > before
					? "groupedAdded"
					: rounds.length === 1
						? "groupedOneRound"
						: "grouped",
			values: { rounds: rounds.length, count: after - before },
		},
	};
}
/** Never invents sets for an exercise that has nothing open. */
export function addToGroup(
	plan: SessionPlan,
	groupId: string,
	exerciseId: string,
	getFacts?: PlanFacts,
): PlanResult {
	const group = plan.groups[groupId];
	if (!group || groupOfExercise(plan, exerciseId))
		return { plan, refused: true, note: { code: "alreadyGrouped" } };
	if (group.state === "closed")
		return { plan, refused: true, note: { code: "groupClosed" } };
	const rows = memberRows(plan, exerciseId, getFacts);
	const open = rows.filter((row) => !row.done);
	const done = rows.filter((row) => row.done);
	// A clock keeps one open set per exercise, so the rest must be safe to lose.
	if (group.mode === "amrap" && open.slice(1).some(isUnsaved))
		return { plan, refused: true, note: { code: "unsavedSets" } };
	const rounds = group.rounds.map((round) => ({
		...round,
		items: [...round.items],
	}));
	const place = (row: PlanSet, index: number) => {
		const round = rounds[index];
		if (round) round.items.push(row);
		else rounds.push({ id: newRowId(), items: [row] });
	};
	done.forEach((row, index) => {
		place(row, index);
	});
	const firstOpen = group.rounds.findIndex((round) => !isRoundComplete(round));
	const from = Math.max(
		done.length,
		firstOpen < 0 ? group.rounds.length : firstOpen,
	);
	const wanted =
		group.mode === "amrap"
			? Math.min(open.length, 1)
			: Math.max(open.length, group.rounds.length - from);
	let added = plan.sets[exerciseId]?.length ? 0 : 1;
	if (open.length) {
		for (let index = 0; index < wanted; index += 1) {
			const own = open[index];
			if (!own) added += 1;
			place(own ?? cloneOpen(open[open.length - 1] as PlanSet), from + index);
		}
	}
	// New rounds repeat the members already there, as grouping two would.
	const repeated = groupExercises(group).flatMap((member) => {
		const mine = groupRows(group).filter((row) => row.exerciseId === member);
		const last = mine[mine.length - 1];
		return last && mine.some((row) => !row.done) ? [last] : [];
	});
	for (const round of rounds.slice(group.rounds.length)) {
		round.items = [...repeated.map(cloneOpen), ...round.items];
		added += repeated.length;
	}
	const { [exerciseId]: _gone, ...sets } = plan.sets;
	return {
		plan: {
			...plan,
			sets,
			order: plan.order.filter(
				(entry) =>
					!(entry.kind === "exercise" && entry.exerciseId === exerciseId),
			),
			groups: {
				...plan.groups,
				[groupId]: normalizeGroup({ ...group, rounds }),
			},
		},
		note:
			added > 0
				? {
						code: added > 1 ? "addedToGroupWithSets" : "addedToGroupWithSet",
						values: { added },
					}
				: { code: "addedToGroup" },
	};
}
function releaseRows(
	plan: SessionPlan,
	groupId: string,
	rows: PlanSet[],
	/** Exercises leaving without rows; they stay in the session, empty. */
	empty: string[] = [],
): SessionPlan {
	const exercises = [
		...new Set([...rows.map((row) => row.exerciseId), ...empty]),
	];
	const at = plan.order.findIndex(
		(entry) => entry.kind === "group" && entry.groupId === groupId,
	);
	const entries: OrderEntry[] = exercises
		.filter(
			(id) =>
				!plan.order.some(
					(entry) => entry.kind === "exercise" && entry.exerciseId === id,
				),
		)
		.map((exerciseId) => ({ kind: "exercise", exerciseId }));
	const sets = { ...plan.sets };
	for (const id of exercises) {
		sets[id] = [
			...(sets[id] ?? []),
			...rows.filter((row) => row.exerciseId === id),
		];
	}
	return {
		...plan,
		sets,
		order: [
			...plan.order.slice(0, at + 1),
			...entries,
			...plan.order.slice(at + 1),
		],
	};
}
/** A group needs two exercises, and a closed AMRAP keeps its score. */
function settleGroup(plan: SessionPlan, group: SetGroup): SessionPlan {
	const names = groupExercises(group);
	if (names.length >= 2 || (group.state === "closed" && names.length > 0))
		return {
			...plan,
			groups: { ...plan.groups, [group.id]: normalizeGroup(group) },
		};
	const released = releaseRows(plan, group.id, groupRows(group));
	const { [group.id]: _gone, ...groups } = released.groups;
	return {
		...released,
		groups,
		order: released.order.filter(
			(entry) => !(entry.kind === "group" && entry.groupId === group.id),
		),
	};
}
/**
 * A group whose rows changed. Membership follows the rows, so an exercise whose
 * last row went stays in the session as a solo exercise instead of vanishing.
 */
function regroup(
	plan: SessionPlan,
	before: SetGroup,
	group: SetGroup,
): SessionPlan {
	const kept = new Set(groupExercises(group));
	const lost = groupExercises(before).filter((id) => !kept.has(id));
	return settleGroup(
		lost.length ? releaseRows(plan, group.id, [], lost) : plan,
		group,
	);
}
export function takeOutOfGroup(
	plan: SessionPlan,
	exerciseId: string,
): PlanResult {
	const group = groupOfExercise(plan, exerciseId);
	if (!group) return { plan };
	if (group.state === "closed")
		return { plan, refused: true, note: { code: "groupClosed" } };
	if (group.state === "running")
		return { plan, refused: true, note: { code: "stopClockFirst" } };
	const out = groupRows(group).filter((row) => row.exerciseId === exerciseId);
	const released = releaseRows(plan, group.id, out);
	const rest = {
		...group,
		rounds: group.rounds
			.map((round) => ({
				...round,
				items: round.items.filter((row) => row.exerciseId !== exerciseId),
			}))
			.filter((round) => round.items.length > 0),
	};
	const dissolved = groupExercises(rest).length < 2;
	return {
		plan: settleGroup(released, rest),
		note: { code: dissolved ? "groupDissolved" : "takenOut" },
	};
}
export function dissolveGroup(plan: SessionPlan, groupId: string): PlanResult {
	const group = plan.groups[groupId];
	if (!group) return { plan };
	if (group.state === "closed")
		return { plan, refused: true, note: { code: "groupClosed" } };
	if (group.state === "running")
		return { plan, refused: true, note: { code: "stopClockFirst" } };
	const released = releaseRows(plan, groupId, groupRows(group));
	const { [groupId]: _gone, ...groups } = released.groups;
	return {
		plan: {
			...released,
			groups,
			order: released.order.filter(
				(entry) => !(entry.kind === "group" && entry.groupId === groupId),
			),
		},
		note: { code: "groupDissolved" },
	};
}
function baseRound(group: SetGroup): GroupRound {
	// A warm-up may sit in the first round, but it is never what a round repeats.
	const first = new Map<string, PlanSet>();
	for (const row of groupRows(group)) {
		const seen = first.get(row.exerciseId);
		if (!seen || (seen.kind === "warmup" && row.kind !== "warmup"))
			first.set(row.exerciseId, row);
	}
	return { id: group.rounds[0]?.id ?? newRowId(), items: [...first.values()] };
}
/** The rounds as saved, with what changed on the clock since: edits and who's in the group. */
function mergeSavedRounds(group: SetGroup, saved: GroupRound[]): GroupRound[] {
	const current = groupRows(group);
	const byId = new Map(current.map((row) => [row.id, row]));
	const members = new Set(current.map((row) => row.exerciseId));
	const known = new Set(
		saved.flatMap((round) => round.items.map((item) => item.exerciseId)),
	);
	const joined = baseRound(group).items.filter(
		(row) => !known.has(row.exerciseId),
	);
	return saved
		.map((round, index) => ({
			...round,
			items: [
				...round.items
					.filter((item) => members.has(item.exerciseId))
					.map((item) => byId.get(item.id) ?? item),
				...joined.map((row) => (index === 0 ? row : cloneOpen(row))),
			],
		}))
		.filter((round) => round.items.length > 0);
}
export function modeLocked(group: SetGroup) {
	return (
		groupRows(group).some((row) => row.done) ||
		(group.mode === "amrap" && group.state !== "idle")
	);
}
export function setGroupMode(
	plan: SessionPlan,
	groupId: string,
	mode: GroupMode,
): PlanResult {
	const group = plan.groups[groupId];
	if (!group || group.mode === mode) return { plan };
	if (modeLocked(group))
		return { plan, refused: true, note: { code: "modeLocked" } };
	const next: SetGroup =
		mode === "amrap"
			? {
					...group,
					mode,
					state: "idle",
					lastRounds: group.rounds.length,
					savedRounds: group.rounds,
					rounds: [baseRound(group)],
				}
			: {
					...group,
					mode,
					state: "idle",
					savedRounds: undefined,
					rounds: (group.savedRounds &&
						mergeSavedRounds(group, group.savedRounds)) ?? [
						baseRound(group),
						...Array.from(
							{ length: Math.max(0, (group.lastRounds ?? 3) - 1) },
							() => ({
								id: newRowId(),
								items: baseRound(group).items.map(cloneOpen),
							}),
						),
					],
				};
	return { plan: { ...plan, groups: { ...plan.groups, [groupId]: next } } };
}
export function setGroupRounds(
	plan: SessionPlan,
	groupId: string,
	delta: 1 | -1,
): PlanResult {
	const group = plan.groups[groupId];
	if (group?.mode !== "rounds") return { plan };
	if (delta > 0) {
		const last = group.rounds[group.rounds.length - 1];
		if (!last) return { plan };
		return {
			plan: {
				...plan,
				groups: {
					...plan.groups,
					[groupId]: {
						...group,
						rounds: [
							...group.rounds,
							{ id: newRowId(), items: baseRound(group).items.map(cloneOpen) },
						],
					},
				},
			},
		};
	}
	const last = group.rounds[group.rounds.length - 1];
	if (group.rounds.length <= 1 || (last && hasLogged(last))) {
		const locked = group.rounds.filter(hasLogged).length;
		return {
			plan,
			refused: true,
			note:
				locked === 0
					? { code: "minimumRound" }
					: {
							code: "roundsLogged",
							values: { count: locked },
						},
		};
	}
	return {
		plan: {
			...plan,
			groups: {
				...plan.groups,
				[groupId]: { ...group, rounds: group.rounds.slice(0, -1) },
			},
		},
	};
}
/** One press of a rest − or + button. */
export const REST_STEP_SECONDS = 15;

export function setGroupRest(
	plan: SessionPlan,
	groupId: string,
	seconds: number,
): SessionPlan {
	const group = plan.groups[groupId];
	if (!group) return plan;
	return {
		...plan,
		groups: {
			...plan.groups,
			[groupId]: { ...group, restSeconds: Math.max(0, seconds) },
		},
	};
}
export function setGroupCap(
	plan: SessionPlan,
	groupId: string,
	minutes: number,
): PlanResult {
	const group = plan.groups[groupId];
	if (!group) return { plan };
	if (group.state !== "idle")
		return {
			plan,
			refused: true,
			note: {
				code: group.state === "closed" ? "groupClosed" : "clockStarted",
			},
		};
	return {
		plan: {
			...plan,
			groups: {
				...plan.groups,
				[groupId]: { ...group, capMinutes: Math.max(1, minutes) },
			},
		},
	};
}
export function runningGroup(plan: SessionPlan) {
	return Object.values(plan.groups).find((group) => group.state === "running");
}
export function startClock(
	plan: SessionPlan,
	groupId: string,
	now: number,
): PlanResult {
	const group = plan.groups[groupId];
	if (group?.mode !== "amrap") return { plan };
	if (runningGroup(plan))
		return { plan, refused: true, note: { code: "otherClockRunning" } };
	const ms =
		group.state === "timeup" && group.stoppedRemaining
			? group.stoppedRemaining
			: group.capMinutes * 60_000;
	return {
		plan: {
			...plan,
			groups: {
				...plan.groups,
				[groupId]: normalizeGroup({
					...group,
					state: "running",
					endsAt: now + ms,
					stoppedRemaining: null,
				}),
			},
		},
	};
}
export function stopClock(
	plan: SessionPlan,
	groupId: string,
	now: number,
): SessionPlan {
	const group = plan.groups[groupId];
	if (group?.state !== "running" || group.endsAt === null) return plan;
	return {
		...plan,
		groups: {
			...plan.groups,
			[groupId]: normalizeGroup({
				...group,
				state: "timeup",
				endsAt: null,
				stoppedRemaining: Math.max(0, group.endsAt - now),
			}),
		},
	};
}
/** A clock reads from its end time, so it is right after a lock or a restart. */
export function tickClocks(plan: SessionPlan, now: number): SessionPlan {
	const running = Object.values(plan.groups).filter(
		(group) =>
			group.state === "running" && group.endsAt !== null && group.endsAt <= now,
	);
	if (!running.length) return plan;
	const groups = { ...plan.groups };
	for (const group of running)
		groups[group.id] = normalizeGroup({
			...group,
			state: "timeup",
			endsAt: null,
			stoppedRemaining: null,
		});
	return { ...plan, groups };
}
export function closeGroup(plan: SessionPlan, groupId: string): SessionPlan {
	const group = plan.groups[groupId];
	if (group?.mode !== "amrap" || group.state === "closed") return plan;
	// Nothing logged leaves nothing to close: the plan stays, ready to start again.
	if (!group.rounds.some(hasLogged))
		return {
			...plan,
			groups: {
				...plan.groups,
				[groupId]: {
					...group,
					state: "idle",
					endsAt: null,
					stoppedRemaining: null,
				},
			},
		};
	const rounds = group.rounds
		.map((round) => ({
			...round,
			partial: round.partial || !isRoundComplete(round),
			items: round.items.filter((row) => row.done),
		}))
		.filter((round) => round.items.length > 0);
	return {
		...plan,
		groups: {
			...plan.groups,
			[groupId]: { ...group, state: "closed", endsAt: null, rounds },
		},
	};
}
export function amrapScore(group: SetGroup) {
	const rounds = group.rounds.filter(
		(round) =>
			round.items.length > 0 && !round.partial && isRoundComplete(round),
	).length;
	const sets = group.rounds
		.filter((round) => round.partial || !isRoundComplete(round))
		.flatMap((round) => round.items)
		.filter((row) => row.done).length;
	return { rounds, sets };
}

export function sameSet(a: PlanSet, b: PlanSet) {
	return (
		near(a.kg, b.kg) &&
		a.reps === b.reps &&
		a.rpe === b.rpe &&
		noteOf(a) === noteOf(b) &&
		a.kind === b.kind &&
		a.unit === b.unit
	);
}
/** Corrections to logged sets that were left without being saved. */
export function unsavedEdits(
	plan: SessionPlan,
	drafts: Record<string, PlanSet>,
) {
	return Object.values(drafts).filter((draft) => {
		const stored = findRow(plan, draft.id);
		return stored?.done && !sameSet(withStoredNote(draft, stored), stored);
	}).length;
}

export function beginAttempt(
	plan: SessionPlan,
	id: string,
	operationId: string,
): PlanSet | null {
	const row = findRow(plan, id);
	if (!row || row.done) return null;
	if (row.attempt) return { ...row, attempt: { ...row.attempt, sent: true } };
	const setNumber = nextSetNumber(plan, row.exerciseId);
	return {
		...row,
		failed: undefined,
		attempt: {
			operationId,
			setNumber,
			payload: payloadFor(row, setNumber),
			sent: true,
		},
	};
}
/** Reads the rest a logged set starts, before that set is marked done. */
export function restAfterLog(plan: SessionPlan, id: string) {
	const row = findRow(plan, id);
	if (!row || row.kind === "warmup") return null;
	const group = groupOfRow(plan, id);
	if (group) {
		if (group.mode === "amrap") return null;
		const round = group.rounds.find((item) =>
			item.items.some((other) => other.id === id),
		);
		return round?.items.every((other) => other.id === id || other.done) &&
			group.restSeconds > 0
			? group.restSeconds
			: null;
	}
	const openLeft = allRows(plan).some(
		(other) => other.id !== id && !other.done,
	);
	return openLeft || row.free ? plan.restDefault : null;
}
function carryLoad(item: PlanSet, from: PlanSet): PlanSet {
	return {
		...item,
		kg: from.kg,
		unit: from.unit,
		typedLbs: from.typedLbs,
		percent: from.percent,
		carried: true,
		blank: item.reps >= 1 ? undefined : item.blank,
	};
}
export function markLogged(
	plan: SessionPlan,
	id: string,
	setId: string,
	setNumber: number,
	facts: ExerciseFacts,
): { plan: SessionPlan; carriedTo: number | null; prior: PlanSet[] } {
	const row = findRow(plan, id);
	if (!row) return { plan, carriedTo: null, prior: [] };
	const reference = referenceFor(plan, facts, row.exerciseId);
	const loggedPercent = reference
		? Math.round((row.kg / reference.value) * 100)
		: null;
	const planKg = row.plan?.kg ?? row.pricedKg ?? 0;
	const logged: PlanSet = {
		...row,
		done: true,
		blank: undefined,
		failed: undefined,
		attempt: undefined,
		orig: undefined,
		setId,
		setNumber,
		loggedPercent,
	};
	const group = groupOfRow(plan, id);
	const prior: PlanSet[] = [row];
	if (!group)
		return {
			plan: replaceRow(plan, id, logged),
			carriedTo: null,
			prior,
		};
	const home = group.rounds.findIndex((round) =>
		round.items.some((item) => item.id === id),
	);
	const carries =
		!near(row.kg, planKg) &&
		(row.reps > 1 || (row.plan?.reps ?? row.reps) <= 1);
	let carriedTo: number | null = null;
	const rounds = group.rounds.map((round, index) => ({
		...round,
		items: round.items.map((item) => {
			if (item.id === id) return logged;
			if (
				!carries ||
				index <= home ||
				item.exerciseId !== row.exerciseId ||
				item.done ||
				isUnsaved(item) ||
				!(near(item.kg, planKg) || item.carried)
			)
				return item;
			prior.push(item);
			carriedTo = shownLoad(row);
			return carryLoad(item, row);
		}),
	}));
	return {
		plan: {
			...plan,
			groups: {
				...plan.groups,
				[group.id]: normalizeGroup({ ...group, rounds }),
			},
		},
		carriedTo,
		prior,
	};
}
function sameRow(a: PlanSet, b: PlanSet) {
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<
		keyof PlanSet
	>;
	return [...keys].every(
		(key) => JSON.stringify(a[key]) === JSON.stringify(b[key]),
	);
}
/** Undo for one logged set: its row and anything the log carried go back. */
export function restoreRows(plan: SessionPlan, prior: PlanSet[]): SessionPlan {
	const [target, ...carried] = prior;
	const byId = new Map(carried.map((row) => [row.id, row]));
	const restored = mapRows(plan, (row) => {
		if (row.id === target?.id) return target;
		// A carried row someone has since logged or changed is no longer ours to undo.
		const before = byId.get(row.id);
		return before && target && sameRow(row, carryLoad(before, target))
			? before
			: row;
	});
	return {
		...restored,
		groups: Object.fromEntries(
			Object.entries(restored.groups).map(([id, group]) => [
				id,
				normalizeGroup(group),
			]),
		),
	};
}
export function markFailed(
	plan: SessionPlan,
	id: string,
	keepAttempt: boolean,
): SessionPlan {
	return mapRows(plan, (row) =>
		row.id === id
			? {
					...row,
					failed: true,
					...(keepAttempt && row.attempt
						? { attempt: { ...row.attempt, sent: false } }
						: { attempt: undefined }),
				}
			: row,
	);
}
export const failedRows = (plan: SessionPlan) =>
	allRows(plan).filter((row) => row.failed && !row.done);

export interface RecapRow {
	exerciseId: string;
	sets: number;
	best: { value: number; measured: boolean } | null;
	was: number | null;
	tag: "newMeasured" | "newEstimated" | "same" | "yourBest" | null;
	topLoad: PlanSet | null;
}
export function newRecordFor(
	plan: SessionPlan,
	row: PlanSet,
	facts: ExerciseFacts,
): {
	kind: "measured" | "estimated";
	value: number;
	was: number | null;
} | null {
	const rm = rowOneRepMax(row, facts);
	if (!rm) return null;
	const known = bestKnown(plan, row.exerciseId, facts, row.id);
	if (row.reps === 1) {
		if (known.measured !== null && row.kg <= known.measured) return null;
		return { kind: "measured", value: row.kg, was: known.measured };
	}
	if (known.estimated === null) return null;
	if (Math.round(rm.value) <= Math.round(known.estimated)) return null;
	return { kind: "estimated", value: rm.value, was: known.estimated };
}
export function recapOf(plan: SessionPlan, getFacts: PlanFacts) {
	const rows = allRows(plan).filter((row) => row.done);
	const volume = workingVolume(
		rows.map((row) => ({
			exerciseId: row.exerciseId,
			weight: row.kg,
			unit: "kg" as const,
			reps: row.reps,
			setType: row.kind,
		})),
	);
	const names = [...new Set(rows.map((row) => row.exerciseId))];
	const orderIndex = (id: string) => {
		const index = sessionExercises(plan).indexOf(id);
		return index < 0 ? Number.MAX_SAFE_INTEGER : index;
	};
	names.sort((a, b) => orderIndex(a) - orderIndex(b));
	const exercises: RecapRow[] = names.map((exerciseId) => {
		const facts = getFacts(exerciseId);
		const mine = rows.filter((row) => row.exerciseId === exerciseId);
		const today = bestToday(plan, exerciseId, facts);
		const best =
			today.measured !== null &&
			(today.estimated === null || today.measured >= today.estimated)
				? { value: today.measured, measured: true }
				: today.estimated !== null
					? { value: today.estimated, measured: false }
					: null;
		const newMeasured =
			today.measured !== null &&
			(facts.measured === null || today.measured > facts.measured);
		const newEstimated =
			!newMeasured &&
			today.estimated !== null &&
			facts.estimated !== null &&
			Math.round(today.estimated) > Math.round(facts.estimated);
		const was = newMeasured
			? facts.measured
			: best?.measured
				? facts.measured
				: facts.estimated;
		const tag = newMeasured
			? "newMeasured"
			: newEstimated
				? "newEstimated"
				: best && was !== null
					? Math.round(best.value) === Math.round(was)
						? "same"
						: "yourBest"
					: null;
		return {
			exerciseId,
			// Working sets, as the header and the progress strip count them.
			sets: mine.filter((row) => row.kind !== "warmup").length,
			best: newMeasured
				? { value: today.measured as number, measured: true }
				: newEstimated
					? { value: today.estimated as number, measured: false }
					: best,
			was,
			tag,
			topLoad:
				[...mine].sort((a, b) => b.kg - a.kg || b.reps - a.reps)[0] ?? null,
		};
	});
	return {
		sets: rows.filter((row) => row.kind !== "warmup").length,
		volume,
		exercises,
		heroes: exercises.filter(
			(row) => row.tag === "newMeasured" || row.tag === "newEstimated",
		),
		groups: Object.values(plan.groups)
			.filter(
				(group) =>
					group.mode === "amrap" && groupRows(group).some((row) => row.done),
			)
			.map((group) => ({
				id: group.id,
				exercises: groupExercises(group),
				...amrapScore(group),
			})),
	};
}
export function closeOpenClocks(plan: SessionPlan): SessionPlan {
	return Object.values(plan.groups)
		.filter(
			(group) =>
				group.mode === "amrap" &&
				(group.state === "running" || group.state === "timeup"),
		)
		.reduce((next, group) => closeGroup(next, group.id), plan);
}
/** Working sets still to do: warm-ups never count (APP-624). */
export function openCount(plan: SessionPlan) {
	return allRows(plan).filter((row) => !row.done && row.kind !== "warmup")
		.length;
}
/** Everything logged, warm-ups too: with none, finishing offers to delete. */
export function loggedCount(plan: SessionPlan) {
	return allRows(plan).filter((row) => row.done).length;
}
/** Working sets logged: the number the header, the strip and Finish show. */
export function workedCount(plan: SessionPlan) {
	return allRows(plan).filter((row) => row.done && row.kind !== "warmup")
		.length;
}
