import type { CSSProperties } from "react";

export interface DateStepperProps {
  /** Long formatted date, e.g. "Wednesday 17 September". */
  label: string;
  /** Optional second line — "Today", or a summary. */
  secondaryLabel?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  /** Pass to make the date itself open a calendar. */
  onChooseDate?: () => void;
  style?: CSSProperties;
}

export function DateStepper(props: DateStepperProps): JSX.Element;
