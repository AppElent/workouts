import type { CSSProperties, ReactNode } from "react";

export interface SkeletonBlockProps {
  width?: number | string;
  height?: number;
  style?: CSSProperties;
}

export interface SkeletonGroupProps {
  /** Spoken once for the whole region, e.g. "Loading the day". */
  label: string;
  children?: ReactNode;
  style?: CSSProperties;
}

export function SkeletonBlock(props: SkeletonBlockProps): JSX.Element;
export function SkeletonGroup(props: SkeletonGroupProps): JSX.Element;
