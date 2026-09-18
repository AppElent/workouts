import type { CSSProperties } from "react";

export interface ChartPoint {
  value: number;
  label?: string;
}

export interface BucketChartProps {
  /** Uppercase micro-title inside the card. */
  title: string;
  /** One line saying exactly what is counted — "Every set type, warmups included." */
  note?: string;
  points: readonly ChartPoint[];
  color?: string;
  height?: number;
  style?: CSSProperties;
}

export function BucketChart(props: BucketChartProps): JSX.Element;
