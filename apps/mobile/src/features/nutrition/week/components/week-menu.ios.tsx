import { Button, Host, Image, Menu } from "@expo/ui/swift-ui";
import { accessibilityLabel } from "@expo/ui/swift-ui/modifiers";
import { useAppearance, useTokens } from "../../../../theme";
import type { WeekMenuProps } from "./week-menu-props";

export function WeekMenu(props: WeekMenuProps) {
	const colors = useTokens();
	const { scheme } = useAppearance();
	return (
		<Host
			colorScheme={scheme}
			seedColor={colors.accent}
			style={{ width: 44, height: 44 }}
		>
			<Menu
				label={<Image systemName="ellipsis" size={22} color={colors.text} />}
				modifiers={[accessibilityLabel(props.label)]}
			>
				<Button
					label={props.openTodayLabel}
					systemImage="fork.knife"
					onPress={props.onOpenToday}
				/>
				<Button
					label={props.goalsLabel}
					systemImage="target"
					onPress={props.onOpenGoals}
				/>
			</Menu>
		</Host>
	);
}
