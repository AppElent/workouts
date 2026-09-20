/**
 * A bounded count as one arc with the number in the hole — the React Native
 * drawing (Android, tests). iOS uses the system `Gauge` in
 * `progress-ring.ios.tsx`. Two stacked half-circles would give a true arc
 * without a native module; the fallback keeps a full ring that fills as the
 * value approaches the bound, which reads the same at a glance.
 */
import { StyleSheet, View } from "react-native";
import { useTokens } from "../theme";
import type { ProgressRingProps } from "./progress-ring.types";
import { AppText } from "./text";

export type { ProgressRingProps };

export function ProgressRing({
	value,
	max,
	accessibilityLabel,
	caption,
	size = 64,
}: ProgressRingProps) {
	const tokens = useTokens();
	const done = max > 0 && value >= max;
	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={accessibilityLabel}
			accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
			style={[
				styles.ring,
				{
					width: size,
					height: size,
					borderRadius: size / 2,
					borderColor: done ? tokens.accent : tokens.accentDim,
				},
			]}
		>
			<AppText style={styles.value}>{value}</AppText>
			{caption ? (
				<AppText variant="caption" style={styles.caption}>
					{caption}
				</AppText>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	ring: { borderWidth: 6, alignItems: "center", justifyContent: "center" },
	value: { fontSize: 18, fontWeight: "800" },
	caption: { fontSize: 9 },
});
