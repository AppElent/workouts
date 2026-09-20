/**
 * The system `Gauge` in its circular-capacity style — Foundry's ProgressRing
 * as the OS draws it (Fitness rings, Battery). One arc in the accent, the
 * number in the hole; VoiceOver reads it as a progress indicator.
 */
import { Gauge, Host, Text } from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	font,
	gaugeStyle,
	scaleEffect,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";
import { useHostScheme, useTokens } from "../theme";
import type { ProgressRingProps } from "./progress-ring.types";
import { AppText } from "./text";

export type { ProgressRingProps };

/** The circular-capacity gauge renders at ~50pt; scale it to the requested size. */
const NATIVE_SIZE = 50;

export function ProgressRing({
	value,
	max,
	accessibilityLabel: label,
	caption,
	size = 64,
}: ProgressRingProps) {
	const tokens = useTokens();
	const scheme = useHostScheme();
	return (
		<View style={{ width: size, alignItems: "center", gap: 2 }}>
			<Host
				colorScheme={scheme}
				seedColor={tokens.accent}
				style={{ width: size, height: size }}
			>
				<Gauge
					value={Math.min(value, max)}
					min={0}
					max={Math.max(max, 1)}
					currentValueLabel={
						<Text modifiers={[font({ weight: "heavy" })]}>{String(value)}</Text>
					}
					modifiers={[
						gaugeStyle("circularCapacity"),
						tint(tokens.accent),
						scaleEffect(size / NATIVE_SIZE),
						accessibilityLabel(label),
					]}
				/>
			</Host>
			{caption ? (
				<AppText variant="caption" style={styles.caption}>
					{caption}
				</AppText>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	caption: { fontSize: 9 },
});
