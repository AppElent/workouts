/**
 * The results the view tools return, shared by the tools (server) and the
 * views (iframe bundle). Plain JSON only.
 */

export const VIEW_NAMES = [
	"week-overview",
	"food-log",
	"exercise-progress",
] as const;
export type ViewName = (typeof VIEW_NAMES)[number];

export function viewUri(view: ViewName) {
	return `ui://foundry/${view}`;
}

export type Meal = "breakfast" | "lunch" | "dinner" | "snacks";

/** The four figures views show; null when the source has no figure. */
export type Macros = {
	energyKcal: number | null;
	proteinG: number | null;
	carbsG: number | null;
	fatG: number | null;
};

export type MacroKey = keyof Macros;

export type MacroGoal = {
	macro: MacroKey;
	direction: "min" | "max";
	target: number;
};

export type WeekActivity = {
	id: string;
	sport: "strength" | "running" | "cycling";
	title?: string;
	occurredAt: string;
	durationSeconds: number;
	distanceMeters?: number;
};

export type WeekDay = {
	date: string;
	activities: WeekActivity[];
	nutrition: Macros & { entryCount: number };
	goals: MacroGoal[];
};

export type WeekOverviewResult = {
	view: "week-overview";
	weekStart: string;
	weekEnd: string;
	previousWeekStart: string;
	nextWeekStart: string;
	/** The week holding the server's today (UTC). */
	isCurrentWeek: boolean;
	days: WeekDay[];
	training: {
		strengthSessions: number;
		runs: number;
		rides: number;
		distanceMeters: number;
		durationSeconds: number;
	};
	nutrition: {
		loggedDays: number;
		energyAverageKcal: number | null;
		proteinAverageG: number | null;
		/** Goals in force on the last day of the week, if any. */
		goals: MacroGoal[];
	};
};

export type ReviewServing = {
	servingIndex: number;
	label: string;
	/** Figures for a quantity of 1 of this serving. */
	perQuantity: Macros;
};

export type ReviewItem = {
	foodId: string;
	name: string;
	servingIndex: number;
	quantity: number;
	servings: ReviewServing[];
};

export type FoodLogReviewResult = {
	view: "food-log";
	date: string;
	meal: Meal;
	/** The token has foundry:write, so the view may call log_food. */
	canLog: boolean;
	items: ReviewItem[];
	/** What the diary already holds for the day. */
	logged: Macros & { entryCount: number };
	goals: MacroGoal[];
};

export const PROGRESS_RANGES = ["4w", "12w", "1y"] as const;
export type ProgressRange = (typeof PROGRESS_RANGES)[number];
export const PROGRESS_METRICS = ["e1rm", "topSet"] as const;
export type ProgressMetric = (typeof PROGRESS_METRICS)[number];

export type ExerciseProgressResult = {
	view: "exercise-progress";
	exercise: { id: string; name: string };
	range: ProgressRange;
	metric: ProgressMetric;
	from: string;
	unit: "kg" | "lbs";
	/** Best value per Strength Session in the range, oldest first. */
	points: { date: string; value: number; weight: number; reps: number }[];
	weeklyVolume: { week: string; volume: number }[];
	oneRepMaxes: {
		date: string;
		value: number;
		unit: "kg" | "lbs";
		source: string;
	}[];
	summary: {
		sessions: number;
		latest: number | null;
		best: number | null;
		change: number | null;
	};
};

export type ViewResult =
	| WeekOverviewResult
	| FoodLogReviewResult
	| ExerciseProgressResult;
