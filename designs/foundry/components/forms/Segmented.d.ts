import type { CSSProperties } from "react";

export interface SegmentedOption {
  value: string;
  label: string;
  /** Spoken instead of the label where the label alone is not a sentence. */
  accessibilityLabel?: string;
}

/**
 * A row of mutually exclusive choices, drawn in the app's own palette.
 */
export interface SegmentedProps {
  options: readonly SegmentedOption[];
  value?: string;
  onChange?: (value: string) => void;
  style?: CSSProperties;
}

export function Segmented(props: SegmentedProps): JSX.Element;
