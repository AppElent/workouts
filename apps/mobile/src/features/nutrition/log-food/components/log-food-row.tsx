import { StyleSheet, View } from "react-native";
import { spacing } from "../../../../theme";
import { SwipeableRow } from "../../../../ui/swipeable-row";
import { offProductCaption } from "../log-food-captions";
import { LogFoodRowLayout, logFoodCellCorners } from "./log-food-row-layout";
import { LogFoodRowLeading } from "./log-food-row-leading";
import type { LogFoodRowProps } from "./log-food-row-props";

/**
 * One food in the results. Plain React Native on every platform: a SwiftUI
 * host per row re-measures after the list has laid out, and rows overlap.
 *
 * Tap opens the portion sheet, + logs the remembered portion. Swipe reveals
 * only Favorite and never commits on a full swipe; long press opens the whole
 * action set, and screen readers get the same set as custom actions.
 */
export function LogFoodRow(props: LogFoodRowProps) {
	const { selection, locale } = props;
	const name = selection.food.name[locale];
	return (
		<View style={[styles.cell, logFoodCellCorners(props.position)]}>
			<SwipeableRow
				actions={props.actions}
				menuTitle={name}
				closeMenuLabel={props.closeMenuLabel}
			>
				{(accessibility) => (
					<LogFoodRowLayout
						leading={
							<LogFoodRowLeading selection={selection} locale={locale} />
						}
						title={name}
						caption={
							selection.kind === "personal"
								? offProductCaption(selection.food.provenance, props.caption)
								: props.caption
						}
						value={props.quickValue}
						portion={props.quickPortion}
						position={props.position}
						inset={false}
						onPress={props.onPress}
						onLongPress={accessibility.onLongPress}
						accessibilityActions={accessibility.accessibilityActions}
						onAccessibilityAction={accessibility.onAccessibilityAction}
						add={{
							label: props.quickLabel,
							busy: props.quickLogging,
							done: props.justLogged,
							onPress: props.onQuickLog,
						}}
					/>
				)}
			</SwipeableRow>
		</View>
	);
}

const styles = StyleSheet.create({
	cell: {
		marginHorizontal: spacing.md,
		overflow: "hidden",
		borderCurve: "continuous",
	},
});
