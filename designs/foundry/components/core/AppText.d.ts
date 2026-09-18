import type { CSSProperties, ReactNode } from "react";

export type TypeVariant =
  | "display" | "title" | "metric" | "heading" | "body" | "label" | "caption"
  /** Native iOS styles: 17/600 row title, 15 secondary, 13 footnote. */
  | "row" | "secondary" | "footnote";

export interface AppTextProps {
  /** Name from the type ramp in tokens/typography.css. */
  variant?: TypeVariant;
  /** Element to render. Use "p"/"h1" etc. where the semantics matter. */
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3";
  /** Clamp to N lines, as React Native's numberOfLines does. */
  numberOfLines?: number;
  style?: CSSProperties;
  children?: ReactNode;
}

export function AppText(props: AppTextProps): JSX.Element;
