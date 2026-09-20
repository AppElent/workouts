/**
 * The system segmented control (`UISegmentedControl` via SwiftUI `Picker`).
 *
 * The RN drawing predates the SwiftUI seam and was justified by the palette:
 * "a platform control cannot take our dark look". With `Host colorScheme` and
 * `seedColor` it can, so the reason is gone and the platform control wins —
 * it brings the selection animation, the press feedback and VoiceOver's
 * "1 of 3" for free. Labels still wrap rather than truncate where the system
 * allows it; four options across a phone remain the ceiling.
 */
import { Host, Picker, Text } from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	pickerStyle,
	tag,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";
import { useHostScheme, useTokens } from "../theme";
import type { SegmentedOption, SegmentedProps } from "./segmented.types";

export type { SegmentedOption, SegmentedProps };

export function Segmented<Value extends string>({
	options,
	value,
	onChange,
}: SegmentedProps<Value>) {
	const tokens = useTokens();
	return (
		<Host
			colorScheme={useHostScheme()}
			seedColor={tokens.accent}
			matchContents={{ vertical: true }}
			style={styles.host}
		>
			<Picker<Value>
				selection={value}
				onSelectionChange={onChange}
				modifiers={[pickerStyle("segmented")]}
			>
				{options.map((option) => (
					<Text
						key={option.value}
						modifiers={[
							tag(option.value),
							...(option.accessibilityLabel
								? [accessibilityLabel(option.accessibilityLabel)]
								: []),
						]}
					>
						{option.label}
					</Text>
				))}
			</Picker>
		</Host>
	);
}

const styles = StyleSheet.create({
	host: { width: "100%" },
});
