import type { CSSProperties, ReactNode } from "react";

export interface InsetListProps {
  /** Uppercase section header above the surface. */
  header?: string;
  /** Footnote under the surface — one line of help. */
  footer?: string;
  /** Right-aligned control beside the header, usually a TextAction. */
  action?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
}

export interface InsetRowProps {
  /** Leading media: SportIcon, MediaThumb or an Icon. */
  leading?: ReactNode;
  title: string;
  secondary?: string;
  /** Trailing value, rendered tabular — a duration, a weight, a count. */
  value?: string;
  chevron?: boolean;
  /** Red title, for a destructive row like "Sign out". */
  destructive?: boolean;
  onPress?: () => void;
  style?: CSSProperties;
}

export function InsetList(props: InsetListProps): JSX.Element;
export function InsetRow(props: InsetRowProps): JSX.Element;
