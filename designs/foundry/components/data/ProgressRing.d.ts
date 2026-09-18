import type { CSSProperties } from "react";

export interface ProgressRingProps {
  value?: number;
  target?: number;
  /** Outer diameter in px. 56 in a summary row, 96 as a screen's focal number. */
  size?: number;
  thickness?: number;
  color?: string;
  track?: string;
  /** Spoken label; defaults to "<value> of <target>". */
  label?: string;
  style?: CSSProperties;
}

export function ProgressRing(props: ProgressRingProps): JSX.Element;
