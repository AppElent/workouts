import {
	editedGoalCount,
	type GoalDirection,
	type GoalPresetKey,
	NUTRIENT_DEFAULT_DIRECTIONS,
	NUTRIENT_KEYS,
	NUTRITION_GOAL_PRESETS,
	type NutrientKey,
} from "@workouts/core/nutrition";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/api";
import { type IsoDate, todayIsoDate } from "../../../data/calendar-day";
import {
	draftFromGoals,
	draftToGoals,
	emptyGoalDraft,
	type GoalDraft,
	type GoalKind,
	goalDraftEquals,
	goalKind,
	setGoalKind,
	withGoal,
	withoutGoal,
} from "../../../data/nutrition-goal-history";
import { useStalledOffline } from "../../../data/stalled-offline";
import { fmt, useI18n } from "../../../i18n";
import { useToast } from "../../../ui/toast";
import type { GoalVersionSummary } from "./goals-applies-from";

/** `nutrient.direction` → the preset a bound was copied from, if unchanged since. */
type Sources = Record<string, GoalPresetKey | undefined>;

type Draft = {
	values: GoalDraft;
	sources: Sources;
	preset: GoalPresetKey | undefined;
};

/** A field is addressed as `nutrient.direction`, in display order. */
export type GoalFieldKey = `${NutrientKey}.${GoalDirection}`;

const emptyDraft = (): Draft => ({
	values: emptyGoalDraft(),
	sources: {},
	preset: undefined,
});

function draftFromServer(
	goals: readonly {
		nutrient: NutrientKey;
		direction: GoalDirection;
		target: number;
		sourcePreset?: GoalPresetKey;
	}[],
): Draft {
	const sources: Sources = {};
	for (const goal of goals)
		sources[`${goal.nutrient}.${goal.direction}`] = goal.sourcePreset;
	// Goals edited since copying lose their source; the rest still name the preset.
	const presets = new Set(
		goals.flatMap((goal) => (goal.sourcePreset ? [goal.sourcePreset] : [])),
	);
	const only = presets.size === 1 ? [...presets][0] : undefined;
	return { values: draftFromGoals(goals), sources, preset: only };
}

function withoutSources(
	sources: Sources,
	nutrient: NutrientKey,
	directions: readonly GoalDirection[] = ["min", "max"],
): Sources {
	const next = { ...sources };
	for (const direction of directions) delete next[`${nutrient}.${direction}`];
	return next;
}

/** The goal editor's draft: everything is local until ✓ saves it for `date`. */
export function useGoalsEditor({
	requestedDate,
	onSaved,
}: {
	requestedDate: IsoDate | undefined;
	onSaved: () => void;
}) {
	const { t } = useI18n();
	const copy = t.nutrition.goalEditor;
	const toast = useToast();
	const [today] = useState(() => todayIsoDate());
	const [date, setDate] = useState<IsoDate>(requestedDate ?? today);
	const [retryNonce, setRetryNonce] = useState(0);
	const response = useQuery(
		api.nutritionGoals.forDate,
		retryNonce % 2 === 0 ? { date } : "skip",
	);
	const replace = useMutation(api.nutritionGoals.replace);
	const { isWebSocketConnected } = useConvexConnectionState();
	const stalledOffline = useStalledOffline(
		response === undefined,
		isWebSocketConnected,
	);
	const [draft, setDraft] = useState<Draft>(emptyDraft);
	const [baseline, setBaseline] = useState<GoalDraft | null>(null);
	const [started, setStarted] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [pending, setPending] = useState(false);
	const saving = useRef(false);
	const dirty = baseline !== null && !goalDraftEquals(draft.values, baseline);

	// Keyed on content: a refreshed but identical response must not reset anything.
	const savedGoals = response ? JSON.stringify(response.goals) : undefined;
	useEffect(() => {
		if (savedGoals === undefined) return;
		const goals = JSON.parse(savedGoals) as Parameters<
			typeof draftFromServer
		>[0];
		setBaseline(draftFromGoals(goals));
		if (!dirty) setDraft(draftFromServer(goals));
	}, [savedGoals, dirty]);

	const displayOrder: readonly NutrientKey[] =
		response?.displayOrder ?? NUTRIENT_KEYS;
	const order: NutrientKey[] = [
		...displayOrder.filter((key) => NUTRIENT_KEYS.includes(key)),
		...NUTRIENT_KEYS.filter((key) => !displayOrder.includes(key)),
	];
	const active = order.filter((nutrient) => goalKind(draft.values[nutrient]));
	const inactive = order.filter((nutrient) => !active.includes(nutrient));
	const fields: GoalFieldKey[] = active.flatMap((nutrient) => {
		const kind = goalKind(draft.values[nutrient]);
		return [
			...(kind !== "max" ? [`${nutrient}.min` as const] : []),
			...(kind !== "min" ? [`${nutrient}.max` as const] : []),
		];
	});
	const changedCount = baseline
		? NUTRIENT_KEYS.filter(
				(nutrient) =>
					draft.values[nutrient].min !== baseline[nutrient].min ||
					draft.values[nutrient].max !== baseline[nutrient].max,
			).length
		: 0;
	const editedCount = draft.preset
		? editedGoalCount(
				draft.preset,
				NUTRIENT_KEYS.flatMap((nutrient) =>
					(["min", "max"] as const).map((direction) => ({
						nutrient,
						direction,
						sourcePreset: draft.sources[`${nutrient}.${direction}`],
					})),
				),
			)
		: 0;
	const showStartPicker =
		response !== undefined && response.goals.length === 0 && !started && !dirty;

	const clearErrors = (nutrient: NutrientKey) =>
		setErrors((current) => {
			const next = { ...current };
			delete next[nutrient];
			return next;
		});

	/** Replaces the whole draft and offers the previous one back. */
	const replaceWithUndo = (next: Draft, message: string) => {
		const before = draft;
		setDraft(next);
		setErrors({});
		setStarted(true);
		toast.success(message, {
			action: { label: copy.undo, onPress: () => setDraft(before) },
		});
	};

	const applyPreset = (key: GoalPresetKey) => {
		const values = emptyGoalDraft();
		const sources: Sources = {};
		for (const goal of NUTRITION_GOAL_PRESETS[key].goals) {
			values[goal.nutrient][goal.direction] = String(goal.target);
			sources[`${goal.nutrient}.${goal.direction}`] = key;
		}
		replaceWithUndo(
			{ values, sources, preset: key },
			fmt(copy.presetApplied, { name: copy.presets[key].name }),
		);
	};

	const save = async () => {
		if (saving.current) return;
		const parsed = draftToGoals(draft.values);
		if (parsed.errors.length > 0) {
			const next: Record<string, string> = {};
			for (const error of parsed.errors) {
				const nutrient = error.key.split(".")[0];
				next[nutrient] ??=
					error.message === "range" ? copy.range : copy.invalid;
			}
			setErrors(next);
			const count = Object.keys(next).length;
			toast.error(
				count === 1 ? copy.invalidOne : fmt(copy.invalidCount, { count }),
			);
			return order.find((nutrient) => next[nutrient]);
		}
		saving.current = true;
		setPending(true);
		try {
			await replace({
				goals: parsed.goals.map((goal) => ({
					...goal,
					sourcePreset: draft.sources[`${goal.nutrient}.${goal.direction}`],
				})),
				effectiveFrom: date,
			});
			onSaved();
		} catch {
			toast.error(copy.failure, {
				action: { label: copy.retry, onPress: () => void save() },
			});
		} finally {
			saving.current = false;
			setPending(false);
		}
		return undefined;
	};

	const version: GoalVersionSummary | undefined = response
		? {
				goals: response.goals.length,
				effectiveFrom: response.effectiveFrom,
				nextEffectiveFrom: response.nextEffectiveFrom,
			}
		: undefined;

	return {
		today,
		date,
		setDate,
		loading: response === undefined,
		/** The draft reflects the saved goals for `date`. */
		ready: baseline !== null,
		stalledOffline,
		retry: () => {
			setRetryNonce((value) => value + 1);
			setTimeout(() => setRetryNonce((value) => value + 1), 0);
		},
		version,
		values: draft.values,
		preset: draft.preset,
		editedCount,
		active,
		inactive,
		fields,
		errors,
		dirty,
		changedCount,
		pending,
		showStartPicker,
		setValue: (
			nutrient: NutrientKey,
			direction: GoalDirection,
			text: string,
		) => {
			setDraft((current) => ({
				...current,
				values: {
					...current.values,
					[nutrient]: { ...current.values[nutrient], [direction]: text },
				},
				sources: withoutSources(current.sources, nutrient, [direction]),
			}));
			clearErrors(nutrient);
		},
		setKind: (nutrient: NutrientKey, kind: GoalKind) => {
			setDraft((current) => ({
				...current,
				values: setGoalKind(current.values, nutrient, kind),
				sources: withoutSources(current.sources, nutrient),
			}));
			clearErrors(nutrient);
		},
		removeGoal: (nutrient: NutrientKey) => {
			setDraft((current) => ({
				...current,
				values: withoutGoal(current.values, nutrient),
				sources: withoutSources(current.sources, nutrient),
			}));
			clearErrors(nutrient);
		},
		/** Adds the nutrient at its reference value; returns the field to focus. */
		addGoal: (nutrient: NutrientKey): GoalFieldKey => {
			setDraft((current) => ({
				...current,
				values: withGoal(current.values, nutrient),
			}));
			setStarted(true);
			return `${nutrient}.${NUTRIENT_DEFAULT_DIRECTIONS[nutrient]}`;
		},
		applyPreset,
		removeAll: () =>
			replaceWithUndo(
				{ values: emptyGoalDraft(), sources: {}, preset: undefined },
				copy.removedAll,
			),
		save,
	};
}
