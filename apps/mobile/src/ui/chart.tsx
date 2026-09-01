/**
 * The app's two chart shapes, and the only place `react-native-gifted-charts`
 * is imported.
 *
 * Wrapped rather than used directly so that swapping the library — or dropping
 * it for hand-drawn Views — is one file, not every screen that shows a trend.
 * The web draws the same charts with Recharts, which is DOM-only and could not
 * come across.
 *
 * Both take pre-shaped points and own nothing but presentation. Deciding *what*
 * to plot stays with the screen; these decide how it looks.
 *
 * Note `react-native-svg` underneath is a native module: after adding it the
 * dev client needs rebuilding, and a JS-only reload will not pick it up.
 */
import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { colors, radius, spacing } from "../theme";
import { AppText } from "./text";

export type Point = { value: number; label?: string };

/** Charts need a pixel width; the parent's is only known after layout. */
function useMeasuredWidth() {
	const [width, setWidth] = useState(0);
	const onLayout = (e: LayoutChangeEvent) =>
		setWidth(e.nativeEvent.layout.width);
	return { width, onLayout };
}

function ChartFrame({
	title,
	note,
	empty,
	children,
	onLayout,
}: {
	title: string;
	note?: string;
	empty: boolean;
	children: React.ReactNode;
	onLayout: (e: LayoutChangeEvent) => void;
}) {
	return (
		<View style={styles.card} onLayout={onLayout}>
			<AppText variant="caption" style={styles.title}>
				{title}
			</AppText>
			{note ? <AppText variant="caption">{note}</AppText> : null}
			{empty ? (
				<AppText variant="caption" style={styles.empty}>
					Not enough data yet.
				</AppText>
			) : (
				children
			)}
		</View>
	);
}

/**
 * A trend over time. Needs two points to mean anything — a single dot is not a
 * line, and drawing one implies a trend that has not been established.
 */
export function TrendChart({
	title,
	note,
	points,
	color = colors.accent,
}: {
	title: string;
	note?: string;
	points: Point[];
	color?: string;
}) {
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
					height={160}
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
	color = colors.accent,
}: {
	title: string;
	note?: string;
	points: Point[];
	color?: string;
}) {
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
					height={160}
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
	card: {
		gap: spacing.xs,
		backgroundColor: colors.surface,
		borderColor: colors.border,
		borderWidth: 1,
		borderRadius: radius.lg,
		padding: spacing.md,
		overflow: "hidden",
	},
	title: {
		color: colors.textMuted,
		fontWeight: "800",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	empty: { paddingVertical: spacing.lg, textAlign: "center" },
	axis: { color: colors.textFaint, fontSize: 9 },
});
