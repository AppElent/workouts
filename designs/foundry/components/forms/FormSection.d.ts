import type { CSSProperties, ReactNode } from "react";

/**
 * Related rows with a heading, separators and optional help text.
 */
export interface FormSectionProps {
  /** Rendered outside the surface, as a muted label. */
  title?: string;
  /** One line of help under the group. */
  footer?: string;
  children?: ReactNode;
  style?: CSSProperties;
}

export function FormSection(props: FormSectionProps): JSX.Element;
