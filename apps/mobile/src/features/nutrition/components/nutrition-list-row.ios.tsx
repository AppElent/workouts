import {
	Button,
	ContextMenu,
	Divider,
	Host,
	RNHostView,
} from "@expo/ui/swift-ui";
import { Fragment } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { spacing, useHostScheme, useTokens } from "../../../theme";
import { SwipeableRow } from "../../../ui/swipeable-row";
import { FoodRowLayout, foodCellCorners } from "./food-row-layout";
import { NutritionListRowLeading } from "./nutrition-list-row-leading";
import type { NutritionListRowProps } from "./nutrition-list-row-props";

/**
 * iOS: long press is the system context menu with the row lifted as its
 * preview (the diary's row contract); swipe reveals Edit and Delete only.
 */
export function NutritionListRow(props: NutritionListRowProps) {
	const colors = useTokens();
	const scheme = useHostScheme();
	const cellWidth = useWindowDimensions().width - 2 * spacing.md;
	const row = (accessibility?: {
		accessibilityActions: readonly { name: string; label: string }[];
		onAccessibilityAction: NonNullable<
			Parameters<typeof FoodRowLayout>[0]["onAccessibilityAction"]
		>;
	}) => (
		<FoodRowLayout
			leading={
				<NutritionListRowLeading selected={props.selected}>
					{props.leading}
				</NutritionListRowLeading>
			}
			title={props.title}
			caption={props.caption}
			value={props.value}
			portion={props.basis}
			position={
				accessibility || props.selected !== undefined ? props.position : "only"
			}
			inset={false}
			chevron={props.selected === undefined}
			rowLabel={
				props.selected === undefined
					? undefined
					: `${props.title}, ${props.selectLabel}`
			}
			onPress={props.onPress}
			accessibilityActions={accessibility?.accessibilityActions}
			onAccessibilityAction={accessibility?.onAccessibilityAction}
		/>
	);
	if (props.selected !== undefined)
		return (
			<View style={[styles.cell, foodCellCorners(props.position)]}>
				{row()}
			</View>
		);
	return (
		<View style={[styles.cell, foodCellCorners(props.position)]}>
			<SwipeableRow
				actions={props.actions}
				menuTitle={props.title}
				closeMenuLabel={props.closeMenuLabel}
			>
				{(accessibility) => (
					<Host
						colorScheme={scheme}
						seedColor={colors.accent}
						matchContents={{ vertical: true }}
						style={styles.host}
					>
						<ContextMenu>
							<ContextMenu.Items>
								{props.actions.map((action) => (
									<Fragment key={action.key}>
										<Button
											label={action.menuLabel ?? action.label}
											systemImage={action.systemImage}
											role={action.destructive ? "destructive" : "default"}
											onPress={action.onPress}
										/>
										{action.dividerAfter ? <Divider /> : null}
									</Fragment>
								))}
							</ContextMenu.Items>
							<ContextMenu.Trigger>
								<RNHostView matchContents>
									<View style={{ width: cellWidth }}>{row(accessibility)}</View>
								</RNHostView>
							</ContextMenu.Trigger>
							<ContextMenu.Preview>
								<RNHostView matchContents>
									<View style={{ width: cellWidth }}>{row()}</View>
								</RNHostView>
							</ContextMenu.Preview>
						</ContextMenu>
					</Host>
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
	host: { width: "100%" },
});
