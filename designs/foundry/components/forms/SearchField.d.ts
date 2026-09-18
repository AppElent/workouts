import type { CSSProperties } from "react";

export interface SearchFieldProps {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  /** Shows a trailing Cancel action once there is text, as iOS does. */
  onCancel?: () => void;
  style?: CSSProperties;
}

export function SearchField(props: SearchFieldProps): JSX.Element;
