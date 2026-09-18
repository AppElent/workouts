import type { CSSProperties } from "react";

export interface StatBoxProps {
  value: string;
  /** Rendered smaller and muted after the value, e.g. "kg". */
  unit?: string;
  label: string;
  /** Overrides the value colour — a sport colour or a semantic one. */
  color?: string;
  style?: CSSProperties;
}

export function StatBox(props: StatBoxProps): JSX.Element;
