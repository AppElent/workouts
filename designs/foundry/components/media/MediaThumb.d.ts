import type { CSSProperties } from "react";

export interface MediaThumbProps {
  /** Omit or let it fail — the initial fallback is a supported state. */
  src?: string;
  alt?: string;
  /** 30 in a compact row, 44 standard, 56 for a food row with two lines. */
  size?: number;
  radius?: number;
  /** Letter to show when there is no image; defaults to the first of alt. */
  fallback?: string;
  style?: CSSProperties;
}

export function MediaThumb(props: MediaThumbProps): JSX.Element;
