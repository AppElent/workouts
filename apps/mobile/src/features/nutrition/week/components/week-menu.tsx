import { ActionSheetIOS, Alert, Platform, Pressable } from "react-native";
import { useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";
import type { WeekMenuProps } from "./week-menu-props";

/** Android and web: the same two actions from a system alert. */
export function WeekMenu(props: WeekMenuProps) {
	const colors = useTokens();
	const open = () => {
		if (Platform.OS === "ios") {
			ActionSheetIOS.showActionSheetWithOptions(
				{ options: [props.openTodayLabel, props.goalsLabel] },
				(index) => (index === 0 ? props.onOpenToday() : props.onOpenGoals()),
			);
			return;
		}
		Alert.alert(props.label, undefined, [
			{ text: props.openTodayLabel, onPress: props.onOpenToday },
			{ text: props.goalsLabel, onPress: props.onOpenGoals },
		]);
	};
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={props.label}
			onPress={open}
			style={{
				width: 44,
				height: 44,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<AppText style={{ color: colors.text, fontWeight: "800" }}>···</AppText>
		</Pressable>
	);
}
