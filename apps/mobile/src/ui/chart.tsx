/**
 * Charts for Android and tests: `react-native-gifted-charts`, and the only
 * place it is imported. iOS draws the same two shapes with Swift Charts in
 * `chart.ios.tsx`. Both take pre-shaped points and own nothing but
 * presentation; deciding *what* to plot stays with the screen.
 *
 * `react-native-svg` underneath is a native module: after adding it the dev
 * client needs rebuilding, and a JS-only reload will not pick it up.
 */
import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet } from "react-native";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { colors, spacing } from "../theme";
import {
	CHART_HEIGHT,
	ChartFrame,
	type ChartProps,
	type Point,
} from "./chart-frame";

export type { ChartProps, Point };

/** Charts need a pixel width; the parent's is only known after layout. */
function useMeasuredWidth() {
	const [width, setWidth] = useState(0);
	const onLayout = (e: LayoutChangeEvent) =>
		setWidth(e.nativeEvent.layout.width);
	return { width, onLayout };
}

/**
 * A trend over time. Needs two points to mean anything — a single dot is not a
 * line, and drawing one implies a trend that has not been established.
 */
export function TrendChart({
	title,
	note,
	points,
	color = colors.accentInk,
}: ChartProps) {
	const { width, onLayout } = useMeasuredWidth();
	const inner = Math.max(0, width - spacing.md * 2);

	return (
		<ChartFrame
			title={title}
			note={note}
			empty={points.length < 2}
			onLayout={onLayout}
		>
			{inner > 0 ? (
				<LineChart
					data={points}
					width={inner}
					height={CHART_HEIGHT}
					initialSpacing={12}
					adjustToWidth
					thickness={2}
					color={color}
					dataPointsColor={color}
					dataPointsRadius={3}
					hideRules
					yAxisColor="transparent"
					xAxisColor={colors.border}
					yAxisTextStyle={styles.axis}
					xAxisLabelTextStyle={styles.axis}
					backgroundColor="transparent"
				/>
			) : null}
		</ChartFrame>
	);
}

/** Discrete buckets — a week's volume, a month's sessions. */
export function BucketChart({
	title,
	note,
	points,
	color = colors.accentInk,
}: ChartProps) {
	const { width, onLayout } = useMeasuredWidth();
	const inner = Math.max(0, width - spacing.md * 2);

	return (
		<ChartFrame
			title={title}
			note={note}
			empty={points.length === 0}
			onLayout={onLayout}
		>
			{inner > 0 ? (
				<BarChart
					data={points}
					width={inner}
					height={CHART_HEIGHT}
					barWidth={16}
					initialSpacing={12}
					spacing={14}
					roundedTop
					frontColor={color}
					hideRules
					yAxisColor="transparent"
					xAxisColor={colors.border}
					yAxisTextStyle={styles.axis}
					xAxisLabelTextStyle={styles.axis}
					backgroundColor="transparent"
				/>
			) : null}
		</ChartFrame>
	);
}

const styles = StyleSheet.create({
	axis: { color: colors.textFaint, fontSize: 9 },
});
