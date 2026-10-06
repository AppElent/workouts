import { SymbolView } from "expo-symbols";
import { StyleSheet, View } from "react-native";
import { spacing, useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";
import { NutritionMenu } from "../../components/nutrition-menu";
import type { LogFoodDestinationMenuProps } from "./log-food-destination-menu-props";

/** Android: the same title and choices, behind the app's sheet menu. */
export function LogFoodDestinationMenu(props: LogFoodDestinationMenuProps) {
	const colors = useTokens();
	return (
		<NutritionMenu
			label={props.label}
			title={props.sectionTitle}
			closeLabel={props.closeLabel}
			trigger={{
				style: styles.trigger,
				content: (
					<View style={styles.title}>
						<View style={styles.row}>
							<AppText variant="navTitle">{props.mealName}</AppText>
							<SymbolView
								name={{
									ios: "chevron.down",
									android: "expand_more",
									web: "expand_more",
								}}
								size={14}
								tintColor={colors.textMuted}
							/>
						</View>
						<AppText variant="caption">{props.dayLabel}</AppText>
					</View>
				),
			}}
			actions={[
				...props.options.map((option, index) => ({
					label: `${option.selected ? "✓ " : ""}${option.label} · ${option.detail}`,
					onPress: () => props.onSelectMeal(option.slot),
					dividerAfter: index === props.options.length - 1,
				})),
				{ label: props.otherDayLabel, onPress: props.onOtherDay },
			]}
		/>
	);
}

const styles = StyleSheet.create({
	trigger: { minHeight: 44, justifyContent: "center" },
	title: { alignItems: "flex-start", paddingHorizontal: spacing.xs },
	row: { flexDirection: "row", alignItems: "center", gap: 4 },
});
