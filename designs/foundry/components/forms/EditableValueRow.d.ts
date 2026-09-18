import type { CSSProperties } from "react";

export interface EditableValueRowProps {
  label: string;
  /** The saved value, summarised — "4 × 5 · 80 kg". */
  value: string;
  /** Text of the visible delete affordance; omit to hide it. */
  deleteLabel?: string;
  onPress?: () => void;
  onDelete?: () => void;
  style?: CSSProperties;
}

export function EditableValueRow(props: EditableValueRowProps): JSX.Element;
