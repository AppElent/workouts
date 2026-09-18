import type { CSSProperties } from "react";

export interface NutritionCalendarProps {
  /** "September 2026" — locale-formatted by the caller. */
  monthLabel?: string;
  /** Monday-based offset of the 1st (0 = Monday). */
  offset?: number;
  days?: number;
  selected?: number;
  today?: number;
  onSelect?: (day: number) => void;
  style?: CSSProperties;
}

export function NutritionCalendar(props: NutritionCalendarProps): JSX.Element;
