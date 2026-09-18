import type { CSSProperties, ReactNode } from "react";

export interface EyebrowProps {
  children?: ReactNode;
  style?: CSSProperties;
}

export function Eyebrow(props: EyebrowProps): JSX.Element;
