/**
 * Placeholder shapes for content that has not arrived.
 *
 * Deliberately still. No shimmer, no pulse: a looping animation is exactly what
 * Reduce Motion asks apps to stop doing, and honouring the setting by not
 * having the animation in the first place is cheaper and more reliable than
 * reading `AccessibilityInfo` on every mount. A block of surface colour already
 * says "not yet".
 *
 * The point of a skeleton is that it occupies the same space as the content it
 * stands in for, so callers compose these blocks into the layout they are about
 * to draw rather than reaching for a generic spinner.
 *
 * One `accessibilityLabel` per skeleton region, on the wrapper: a screen reader
 * should hear "loading the day" once, not eleven unlabelled rectangles.
 */
import type { ReactNode } from "react";
import { type DimensionValue, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../theme";

export function SkeletonBlock({
	width = "100%",
	height = 14,
	style,
}: {
	width?: DimensionValue;
	height?: number;
	style?: object;
}) {
	return (
		<View
			style={[
				styles.block,
				{ width, height, borderRadius: Math.min(height / 2, radius.md) },
				style,
			]}
		/>
	);
}

export function SkeletonGroup({
	label,
	children,
}: {
	/** Spoken once for the whole region. */
	label: string;
	children: ReactNode;
}) {
	return (
		<View accessible accessibilityLabel={label} style={styles.group}>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	block: { backgroundColor: colors.surface2 },
	group: { gap: spacing.md },
});
