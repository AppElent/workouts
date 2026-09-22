import { SymbolView } from "expo-symbols";
import { StyleSheet } from "react-native";
import { radius, type Tokens, useThemedStyles, useTokens } from "../theme";
import type { FoodBrowserMenuProps } from "./nutrition-food-browser-menu.types";
import { NutritionMenu } from "./nutrition-menu";

/** Android keeps the app's existing sheet presentation behind the same +. */
export function FoodBrowserMenu(props: FoodBrowserMenuProps) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<NutritionMenu
			label={props.label}
			closeLabel={props.closeLabel}
			trigger={{
				style: styles.control,
				content: (
					<SymbolView
						name={{ ios: "plus", android: "add", web: "add" }}
						size={19}
						tintColor={colors.text}
					/>
				),
			}}
			actions={[
				{
					label: props.logOnceLabel,
					onPress: props.onLogOnce,
					dividerAfter: true,
				},
				{ label: props.newFoodLabel, onPress: props.onNewFood },
				{
					label: props.newRecipeLabel,
					onPress: props.onNewRecipe,
					dividerAfter: props.canSaveAsNote,
				},
				...(props.canSaveAsNote
					? [{ label: props.saveAsNoteLabel, onPress: props.onSaveAsNote }]
					: []),
			]}
		/>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		control: {
			width: 40,
			height: 40,
			minWidth: 40,
			minHeight: 40,
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
	});
