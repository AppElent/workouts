import type { CSSProperties, ReactNode } from "react";

/**
 * Bottom-sheet shell: grabber, title row, scrollable content.
 */
export interface SheetProps {
  title?: string;
  subtitle?: string;
  /** Right-hand action label; "Done" or "Close". */
  doneLabel?: string;
  onDone?: () => void;
  /** Rough native detent equivalent. */
  detent?: "small" | "medium" | "large";
  children?: ReactNode;
  style?: CSSProperties;
}

export function Sheet(props: SheetProps): JSX.Element;
