import { StyleSheet, View } from "react-native";
import { spacing } from "../../../../theme";
import { SwipeableRow } from "../../../../ui/swipeable-row";
import {
	FoodRowLayout,
	foodCellCorners,
} from "../../components/food-row-layout";
import { LibraryRowLeading } from "./library-row-leading";
import type { LibraryRowProps } from "./library-row-props";

/**
 * One library item (Android and tests; iOS has `library-row.ios.tsx`). Tap
 * opens it; swipe reveals Edit and Delete without committing; long press
 * shows the full set, which screen readers get as custom actions.
 */
export function LibraryRow(props: LibraryRowProps) {
	const layout = (accessibility?: {
		onLongPress?: () => void;
		accessibilityActions?: readonly { name: string; label: string }[];
		onAccessibilityAction?: Parameters<
			typeof FoodRowLayout
		>[0]["onAccessibilityAction"];
	}) => (
		<FoodRowLayout
			leading={
				<LibraryRowLeading selected={props.selected}>
					{props.leading}
				</LibraryRowLeading>
			}
			title={props.title}
			caption={props.caption}
			value={props.value}
			portion={props.basis}
			position={props.position}
			inset={false}
			chevron={props.selected === undefined}
			rowLabel={
				props.selected === undefined
					? undefined
					: `${props.title}, ${props.selectLabel}`
			}
			onPress={props.onPress}
			onLongPress={accessibility?.onLongPress}
			accessibilityActions={accessibility?.accessibilityActions}
			onAccessibilityAction={accessibility?.onAccessibilityAction}
		/>
	);
	return (
		<View style={[styles.cell, foodCellCorners(props.position)]}>
			{props.selected === undefined ? (
				<SwipeableRow
					actions={props.actions}
					menuTitle={props.title}
					closeMenuLabel={props.closeMenuLabel}
				>
					{(accessibility) => layout(accessibility)}
				</SwipeableRow>
			) : (
				layout()
			)}
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
