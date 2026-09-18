import type { CSSProperties } from "react";
import type { ChartPoint } from "./BucketChart";

export interface TrendChartProps {
  title: string;
  note?: string;
  /** Fewer than two points renders the empty note instead of a line. */
  points: readonly ChartPoint[];
  color?: string;
  height?: number;
  style?: CSSProperties;
}

export function TrendChart(props: TrendChartProps): JSX.Element;
