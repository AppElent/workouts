import type { CSSProperties } from "react";

export interface RestTimerBarProps {
  /** Formatted remainder, "m:ss". Derived from an end timestamp, never ticked down. */
  remaining?: string;
  paused?: boolean;
  /** Reads "Rest over" and borders in accent. */
  done?: boolean;
  /** Persisted per device: 60 | 90 | 120 | 180. */
  defaultSeconds?: number;
  onAdjust?: (delta: number) => void;
  onTogglePause?: () => void;
  onDismiss?: () => void;
  onChooseDefault?: (seconds: number) => void;
  style?: CSSProperties;
}

export function RestTimerBar(props: RestTimerBarProps): JSX.Element;
