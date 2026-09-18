import type { CSSProperties, ReactNode } from "react";

export interface GroupedSurfaceProps {
  children?: ReactNode;
  style?: CSSProperties;
}

export function GroupedSurface(props: GroupedSurfaceProps): JSX.Element;
