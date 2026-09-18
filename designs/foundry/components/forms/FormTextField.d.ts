import type { CSSProperties } from "react";

export interface FormTextFieldProps {
  label: string;
  value?: string;
  /** Right-aligned hint in --text-faint, e.g. "Required". */
  placeholder?: string;
  /** Shown as a 13pt red footnote under the row and announced as an alert. */
  error?: string;
  type?: "text" | "email" | "password" | "number";
  /** "inline" is the iOS grouped-list default: label left, borderless value right. */
  layout?: "inline" | "stacked";
  /** Forces a stacked three-line text area — notes only. */
  multiline?: boolean;
  onChange?: (value: string) => void;
  style?: CSSProperties;
}

export function FormTextField(props: FormTextFieldProps): JSX.Element;
