import {
	Button,
	Divider,
	Host,
	Image,
	type ImageProps,
	Menu,
	RNHostView,
	Section,
} from "@expo/ui/swift-ui";
import { accessibilityLabel, tint } from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { useHostScheme, useTokens } from "../../../../theme";
export function DiaryMealMenu({
	label,
	title,
	actions,
	trigger,
}: {
	label: string;
	title?: string;
	closeLabel: string;
	actions: readonly {
		label: string;
		menuLabel?: string;
		onPress: () => void;
		dividerAfter?: boolean;
		systemImage?: ImageProps["systemName"];
	}[];
	trigger?: {
		readonly content: ReactNode;
		readonly style?: StyleProp<ViewStyle>;
	};
}) {
	const colors = useTokens();
	return (
		<Host
			matchContents
			colorScheme={useHostScheme()}
			style={trigger?.style ?? { minWidth: 44, minHeight: 44 }}
		>
			<Menu
				label={
					trigger ? (
						<RNHostView matchContents>
							<View>{trigger.content}</View>
						</RNHostView>
					) : (
						<Image systemName="ellipsis" size={22} color={colors.accent} />
					)
				}
				modifiers={[accessibilityLabel(label)]}
			>
				<Section title={title}>
					{actions.flatMap((action) => [
						<Button
							key={action.label}
							label={action.menuLabel ?? action.label}
							modifiers={[tint(colors.text)]}
							systemImage={action.systemImage}
							onPress={action.onPress}
						/>,
						...(action.dividerAfter
							? [<Divider key={`divider-${action.label}`} />]
							: []),
					])}
				</Section>
			</Menu>
		</Host>
	);
}
