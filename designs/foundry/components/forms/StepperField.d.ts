import type { CSSProperties } from "react";

export interface StepperFieldProps {
  /** Unit or field name: "kg", "reps". Shown under the value in `field`, spoken in `compact`. */
  label: string;
  value?: number;
  /** Per-equipment: barbell 2.5, dumbbell 1, cable/machine 5, kettlebell 4. */
  step?: number;
  min?: number;
  onChange?: (value: number) => void;
  /** `field` = standalone control (set logger). `compact` = 32pt row accessory. */
  variant?: "field" | "compact";
  /** `field` only. 48 in forms, 56 in the set logger. */
  height?: number;
  style?: CSSProperties;
}

export function StepperField(props: StepperFieldProps): JSX.Element;
