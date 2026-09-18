import type { CSSProperties } from "react";

export interface ChipProps {
  label: string;
  /** Selected. Colour is never the only signal — aria-pressed is set too. */
  active?: boolean;
  /** Overrides the inactive label colour, e.g. a sport colour. */
  color?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

export function Chip(props: ChipProps): JSX.Element;
