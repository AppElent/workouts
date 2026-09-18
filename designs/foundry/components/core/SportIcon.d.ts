import type { CSSProperties } from "react";

export type SportKey = "strength" | "running" | "cycling" | "wod";

export interface SportIconProps {
  sport?: SportKey;
  /** Square side in px; the corner radius is 32% of it. */
  size?: number;
  style?: CSSProperties;
}

export function SportIcon(props: SportIconProps): JSX.Element;
