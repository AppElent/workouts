import type { CSSProperties, ReactNode } from "react";

/**
 * Grouped opaque surface for one object or summary.
 */
export interface CardProps {
  /** "accent" tints the card and borders it in lime — reserved for in-progress state. */
  tone?: "default" | "accent";
  style?: CSSProperties;
  children?: ReactNode;
}

export function Card(props: CardProps): JSX.Element;
