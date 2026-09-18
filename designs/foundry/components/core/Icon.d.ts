import type { CSSProperties } from "react";

export interface IconProps {
  /** An SF Symbol name the app uses ("house.fill", "fork.knife") or a raw Lucide name. */
  name: string;
  size?: number;
  color?: string;
  style?: CSSProperties;
}

export function Icon(props: IconProps): JSX.Element;
