import type { MealSlot } from "./nutrition-day";
export type DraftMeal = MealSlot;
export type CaptureDraft = {
	readonly id: string;
	readonly subject: string;
	readonly date: string;
	readonly meal: DraftMeal;
	readonly note: string;
	readonly createdAt: number;
	readonly updatedAt: number;
};
export type CaptureDraftInput = Pick<CaptureDraft, "date" | "meal" | "note">;
export type OtherDaysSummary = {
	readonly count: number;
	readonly oldestDate: string | undefined;
};
