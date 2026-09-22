import { Button, Host, Menu, Text } from "@expo/ui/swift-ui";
import { accessibilityLabel } from "@expo/ui/swift-ui/modifiers";
import { useAppearance, useTokens } from "../theme";
import type { FoodVisualMenuProps } from "./food-visual-menu.types";

export function FoodVisualMenu<Value extends string>({
	label,
	options,
	selectedValue,
	onSelect,
}: FoodVisualMenuProps<Value>) {
	const colors = useTokens();
	const { scheme } = useAppearance();
	return (
		<Host
			colorScheme={scheme}
			seedColor={colors.accent}
			matchContents={{ vertical: true }}
			style={{ minHeight: 44, alignSelf: "stretch" }}
		>
			<Menu
				label={<Text>{label}</Text>}
				modifiers={[accessibilityLabel(label)]}
			>
				{options.map((option) => (
					<Button
						key={option.value}
						label={option.label}
						systemImage={
							option.value === selectedValue ? "checkmark" : undefined
						}
						onPress={() => onSelect(option.value)}
					/>
				))}
			</Menu>
		</Host>
	);
}
