/**
 * The card around a chart, shared by the Swift Charts drawing (`chart.ios.tsx`)
 * and the `react-native-gifted-charts` drawing (`chart.tsx`). Owns the title,
 * the note, and the one honest empty state — "Not enough data yet." instead of
 * a chart with one point (Foundry, "Numbers are qualified honestly").
 */
import type { ReactNode } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { radius, spacing, useTokens } from "../theme";
import { AppText } from "./text";

export type Point = { value: number; label?: string };

export interface ChartProps {
	title: string;
	note?: string;
	points: Point[];
	/** Series colour; defaults to the accent ink. */
	color?: string;
}

/** Charts want a pixel height; keep it one number across both drawings. */
export const CHART_HEIGHT = 160;

export function ChartFrame({
	title,
	note,
	empty,
	children,
	onLayout,
}: {
	title: string;
	note?: string;
	empty: boolean;
	children: ReactNode;
	onLayout?: (e: LayoutChangeEvent) => void;
}) {
	const tokens = useTokens();
	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: tokens.surface, borderColor: tokens.border },
			]}
			onLayout={onLayout}
		>
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

const styles = StyleSheet.create({
	card: {
		gap: spacing.xs,
		borderWidth: 1,
		borderRadius: radius.cardLg,
		borderCurve: "continuous",
		padding: spacing.md,
		overflow: "hidden",
	},
	title: {
		fontWeight: "800",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	empty: { paddingVertical: spacing.lg, textAlign: "center" },
});
