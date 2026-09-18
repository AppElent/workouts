import type { CSSProperties, ReactNode } from "react";

export interface InlineNumberFieldRowProps {
  label: string;
  value?: string | number;
  /** Unit shown after the field, e.g. "g", "kg", "kcal". */
  suffix: string;
  /** Extra control at the end of the row — a stepper or a menu button. */
  accessory?: ReactNode;
  onChange?: (value: string) => void;
  style?: CSSProperties;
}

export function InlineNumberFieldRow(props: InlineNumberFieldRowProps): JSX.Element;
