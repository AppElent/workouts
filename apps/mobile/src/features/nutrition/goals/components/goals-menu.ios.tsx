import {
	Button,
	Host,
	Menu,
	RNHostView,
	Section,
	Text,
	Toggle,
} from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	disabled,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";
import { useHostScheme, useTokens } from "../../../../theme";
import type { GoalsMenuItem, GoalsMenuProps } from "./goals-menu-props";

/** SwiftUI's button role, not an ARIA role. */
const DESTRUCTIVE = "destructive" as const;

function itemContent(item: GoalsMenuItem) {
	return item.hint
		? [
				<Text key="label">{item.label}</Text>,
				<Text key="hint">{item.hint}</Text>,
			]
		: [<Text key="label">{item.label}</Text>];
}

/** SwiftUI `Menu`: choices carry the system checkmark, hints sit under labels. */
export function GoalsMenu({
	accessibilityLabel: label,
	title,
	sections,
	onSelect,
	disabled: isDisabled = false,
	children,
	style,
}: GoalsMenuProps) {
	const colors = useTokens();
	return (
		<Host matchContents colorScheme={useHostScheme()} style={style}>
			<Menu
				label={
					<RNHostView matchContents>
						<View>{children}</View>
					</RNHostView>
				}
				modifiers={[accessibilityLabel(label), disabled(isDisabled)]}
			>
				{sections.map((items, index) => (
					<Section
						key={items[0]?.id ?? index}
						title={index === 0 ? title : undefined}
					>
						{items.map((item) =>
							item.selected !== undefined ? (
								<Toggle
									key={item.id}
									isOn={item.selected}
									onIsOnChange={() => onSelect(item.id)}
								>
									{itemContent(item)}
								</Toggle>
							) : item.destructive ? (
								<Button
									key={item.id}
									label={item.label}
									systemImage="trash"
									role={DESTRUCTIVE}
									onPress={() => onSelect(item.id)}
								/>
							) : (
								<Button
									key={item.id}
									modifiers={[tint(colors.text)]}
									onPress={() => onSelect(item.id)}
								>
									{itemContent(item)}
								</Button>
							),
						)}
					</Section>
				))}
			</Menu>
		</Host>
	);
}
