import type { CSSProperties } from "react";

export interface ActiveSessionBarProps {
  /** Session name, or "Free session". */
  name?: string;
  /** "0:42" under an hour, "1:02:47" over it. */
  elapsed?: string;
  onPress?: () => void;
  style?: CSSProperties;
}

export function ActiveSessionBar(props: ActiveSessionBarProps): JSX.Element;
