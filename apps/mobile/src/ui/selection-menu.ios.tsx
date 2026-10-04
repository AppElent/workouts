import {
	Button,
	Host,
	HStack,
	Image,
	Menu,
	Section,
	Text,
} from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	disabled,
	padding,
} from "@expo/ui/swift-ui/modifiers";
import { useAppearance } from "../theme";
import type { SelectionMenuProps } from "./selection-menu.types";
export function SelectionMenu(props: SelectionMenuProps) {
	const { scheme, colors } = useAppearance();
	return (
		<Host
			colorScheme={scheme}
			seedColor={colors.text}
			matchContents
			style={{ minHeight: 48, justifyContent: "center" }}
		>
			<Menu
				label={
					<HStack
						spacing={6}
						modifiers={[padding({ horizontal: 12, vertical: 12 })]}
					>
						<Text>{props.label}</Text>
						<Image systemName="chevron.up.chevron.down" size={12} />
					</HStack>
				}
				modifiers={[
					accessibilityLabel(props.accessibilityLabel),
					disabled(Boolean(props.disabled)),
				]}
			>
				{props.groups.map((group, index) => (
					<Section key={group.title ?? index} title={group.title}>
						{group.options.map((option) => (
							<Button
								key={option.id}
								label={option.label}
								systemImage={option.selected ? "checkmark" : undefined}
								modifiers={[disabled(Boolean(option.disabled))]}
								onPress={() => props.onSelect(option.id)}
							/>
						))}
					</Section>
				))}
			</Menu>
		</Host>
	);
}
