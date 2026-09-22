import { Button, Divider, Host, Image, Menu } from "@expo/ui/swift-ui";
import { accessibilityLabel } from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";
import {
	radius,
	type Tokens,
	useAppearance,
	useThemedStyles,
	useTokens,
} from "../theme";
import type { FoodBrowserMenuProps } from "./nutrition-food-browser-menu.types";

/** A SwiftUI `Menu` anchored to the +, so it floats over the list rather than displacing it. */
export function FoodBrowserMenu(props: FoodBrowserMenuProps) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const { scheme } = useAppearance();
	return (
		<View style={styles.control}>
			<Host colorScheme={scheme} seedColor={colors.accent} style={styles.host}>
				<Menu
					label={<Image systemName="plus" size={19} />}
					modifiers={[accessibilityLabel(props.label)]}
				>
					<Button
						label={props.logOnceLabel}
						systemImage="timer"
						onPress={props.onLogOnce}
					/>
					<Divider />
					<Button
						label={props.newFoodLabel}
						systemImage="square.and.pencil"
						onPress={props.onNewFood}
					/>
					<Button
						label={props.newRecipeLabel}
						systemImage="text.book.closed"
						onPress={props.onNewRecipe}
					/>
					{props.canSaveAsNote ? (
						<>
							<Divider />
							<Button
								label={props.saveAsNoteLabel}
								systemImage="note.text"
								onPress={props.onSaveAsNote}
							/>
						</>
					) : null}
				</Menu>
			</Host>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		control: {
			width: 40,
			height: 40,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
		host: { width: 40, height: 40 },
	});
