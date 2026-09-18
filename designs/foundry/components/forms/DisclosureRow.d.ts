import type { CSSProperties } from "react";

export interface DisclosureRowProps {
  label: string;
  /** Current value, shown muted before the glyph. */
  value?: string;
  /** Omit for navigation (chevron); pass a boolean for in-place expansion (+/−). */
  expanded?: boolean;
  onPress?: () => void;
  style?: CSSProperties;
}

export function DisclosureRow(props: DisclosureRowProps): JSX.Element;
