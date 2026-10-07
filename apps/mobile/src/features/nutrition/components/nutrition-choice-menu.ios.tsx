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
import { useHostScheme, useTokens } from "../../../theme";
import type {
	NutritionChoiceMenuItem,
	NutritionChoiceMenuProps,
} from "./nutrition-choice-menu-props";

/** SwiftUI's button role, not an ARIA role. */
const DESTRUCTIVE = "destructive" as const;

function itemContent(item: NutritionChoiceMenuItem) {
	return item.hint
		? [
				<Text key="label">{item.label}</Text>,
				<Text key="hint">{item.hint}</Text>,
			]
		: [<Text key="label">{item.label}</Text>];
}

/** SwiftUI `Menu`: choices carry the system checkmark, hints sit under labels. */
export function NutritionChoiceMenu({
	accessibilityLabel: label,
	title,
	sections,
	onSelect,
	disabled: isDisabled = false,
	children,
	style,
}: NutritionChoiceMenuProps) {
	const colors = useTokens();
	const renderItem = (item: NutritionChoiceMenuItem) =>
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
				systemImage={item.symbol ?? "trash"}
				role={DESTRUCTIVE}
				onPress={() => onSelect(item.id)}
			/>
		) : item.symbol && !item.hint ? (
			<Button
				key={item.id}
				label={item.label}
				systemImage={item.symbol}
				modifiers={[tint(colors.text)]}
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
		);
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
							item.submenu ? (
								<Menu
									key={item.id}
									label={itemContent(item)}
									systemImage={item.symbol}
								>
									{item.submenu.map((choice) => renderItem(choice))}
								</Menu>
							) : (
								renderItem(item)
							),
						)}
					</Section>
				))}
			</Menu>
		</Host>
	);
}
