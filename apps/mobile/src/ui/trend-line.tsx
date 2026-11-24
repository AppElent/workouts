/**
 * A frameless trend: one line over a soft area, scaled to its own range, with
 * the latest point marked (APP-619, the exercise overview's 1RM card).
 *
 * Swift Charts and gifted-charts both start the y-axis at zero and draw their
 * own axes, which flattens a 92 → 101 kg climb into a straight line. This is
 * drawn with SVG instead, the same on both platforms. The numbers it shows are
 * spoken by the card above it, so the drawing itself is hidden from a screen
 * reader except for a one-line summary.
 */
import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { spacing, useTokens } from "../theme";
import { AppText } from "./text";

export type TrendPoint = { value: number; label?: string };

const PAD_Y = 10;
const DOT = 5;

export function TrendLine({
	points,
	height = 160,
	summary,
}: {
	points: TrendPoint[];
	height?: number;
	/** Spoken instead of the drawing, e.g. "From 92 to 101 kg". */
	summary?: string;
}) {
	const colors = useTokens();
	const [width, setWidth] = useState(0);
	const onLayout = (event: LayoutChangeEvent) =>
		setWidth(Math.round(event.nativeEvent.layout.width));
	const values = points.map((point) => point.value);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	const inner = width - DOT * 2;
	const x = (index: number) =>
		DOT +
		(points.length < 2 ? inner / 2 : (index / (points.length - 1)) * inner);
	const y = (value: number) =>
		PAD_Y + (1 - (value - min) / span) * (height - PAD_Y * 2);
	const line = points
		.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.value)}`)
		.join(" ");
	const area = `${line} L${x(points.length - 1)},${height} L${x(0)},${height} Z`;
	const last = points.at(-1);
	const middle = points[Math.floor((points.length - 1) / 2)];
	const labels = [
		points[0]?.label,
		points.length > 2 ? middle?.label : undefined,
		last?.label,
	];
	return (
		<View
			accessible
			accessibilityRole="image"
			accessibilityLabel={summary}
			style={styles.root}
		>
			<View onLayout={onLayout} style={{ height }}>
				{width > 0 && points.length >= 2 ? (
					<Svg width={width} height={height}>
						{[1 / 3, 2 / 3].map((at) => (
							<Line
								key={at}
								x1={0}
								x2={width}
								y1={height * at}
								y2={height * at}
								stroke={colors.separator}
								strokeWidth={1}
							/>
						))}
						<Path d={area} fill={colors.surface2} />
						<Path
							d={line}
							stroke={colors.accentInk}
							strokeWidth={3}
							strokeLinejoin="round"
							strokeLinecap="round"
							fill="none"
						/>
						{last ? (
							<Circle
								cx={x(points.length - 1)}
								cy={y(last.value)}
								r={DOT}
								fill={colors.accentInk}
							/>
						) : null}
					</Svg>
				) : null}
			</View>
			<View
				style={styles.labels}
				importantForAccessibility="no-hide-descendants"
			>
				{labels.map((label, index) => (
					<AppText
						// Three fixed slots: first, middle, last.
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
						key={index}
						variant="caption"
						style={[
							styles.label,
							{ color: colors.textMuted },
							index === 1 && styles.center,
							index === 2 && styles.end,
						]}
					>
						{label ?? ""}
					</AppText>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { gap: spacing.xs },
	labels: { flexDirection: "row" },
	label: { flex: 1, minWidth: 0 },
	center: { textAlign: "center" },
	end: { textAlign: "right" },
});
