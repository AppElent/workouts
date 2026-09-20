/**
 * Swift Charts — the framework the Health and Fitness apps draw with. One
 * series in the accent ink, 2pt line with 3pt points, 16pt bars with a rounded
 * top, no grid (Foundry, "Charts"). Under two points a trend says "Not enough
 * data yet." instead of drawing.
 */
import { Chart, Host } from "@expo/ui/swift-ui";
import { StyleSheet } from "react-native";
import { useHostScheme, useTokens } from "../theme";
import {
	CHART_HEIGHT,
	ChartFrame,
	type ChartProps,
	type Point,
} from "./chart-frame";

export type { ChartProps, Point };

function toData(points: Point[]) {
	return points.map((p, i) => ({ x: p.label ?? String(i + 1), y: p.value }));
}

export function TrendChart({ title, note, points, color }: ChartProps) {
	const tokens = useTokens();
	const scheme = useHostScheme();
	const ink = color ?? tokens.accentInk;
	return (
		<ChartFrame title={title} note={note} empty={points.length < 2}>
			<Host colorScheme={scheme} seedColor={tokens.accent} style={styles.host}>
				<Chart
					type="line"
					data={toData(points)}
					showGrid={false}
					animate={false}
					lineStyle={{
						width: 2,
						pointStyle: "circle",
						pointSize: 6,
						color: ink,
					}}
				/>
			</Host>
		</ChartFrame>
	);
}

export function BucketChart({ title, note, points, color }: ChartProps) {
	const tokens = useTokens();
	const scheme = useHostScheme();
	const ink = color ?? tokens.accentInk;
	return (
		<ChartFrame title={title} note={note} empty={points.length === 0}>
			<Host colorScheme={scheme} seedColor={tokens.accent} style={styles.host}>
				<Chart
					type="bar"
					data={toData(points).map((d) => ({ ...d, color: ink }))}
					showGrid={false}
					animate={false}
					barStyle={{ cornerRadius: 4, width: 16 }}
				/>
			</Host>
		</ChartFrame>
	);
}

const styles = StyleSheet.create({
	host: { width: "100%", height: CHART_HEIGHT },
});
