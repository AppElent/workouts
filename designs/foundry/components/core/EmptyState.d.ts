import type { CSSProperties } from "react";

export interface EmptyStateProps {
  title?: string;
  /** One sentence saying what goes here. Never just "No data". */
  body: string;
  /** Omit when the region's add control lives in its header. */
  action?: { label: string; onPress: () => void };
  /** "search" centres the state in a 320px-tall region with a magnifier. */
  appearance?: "default" | "search";
  style?: CSSProperties;
}

export function EmptyState(props: EmptyStateProps): JSX.Element;
