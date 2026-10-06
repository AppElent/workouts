import {
	Button,
	ContextMenu,
	Divider,
	Host,
	RNHostView,
} from "@expo/ui/swift-ui";
import { Fragment } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { spacing, useHostScheme, useTokens } from "../../../../theme";
import { SwipeableRow } from "../../../../ui/swipeable-row";
import { offProductCaption } from "../log-food-captions";
import { LogFoodRowLayout, logFoodCellCorners } from "./log-food-row-layout";
import { LogFoodRowLeading } from "./log-food-row-leading";
import type { LogFoodRowProps } from "./log-food-row-props";

/**
 * iOS: the row's long press is the system context menu with the row lifted as
 * its preview (the diary's row contract). Swipe still reveals Favorite only,
 * and VoiceOver gets every action as a custom action.
 */
export function LogFoodRow(props: LogFoodRowProps) {
	const { selection, locale } = props;
	const colors = useTokens();
	const scheme = useHostScheme();
	const name = selection.food.name[locale];
	// RN content in a SwiftUI host sizes to itself; pin it to the cell's width
	// so every row spans the card instead of shrinking to its text.
	const cellWidth = useWindowDimensions().width - 2 * spacing.md;
	const row = (accessibility?: {
		accessibilityActions: readonly { name: string; label: string }[];
		onAccessibilityAction: LogFoodRowLayoutA11y;
	}) => (
		<LogFoodRowLayout
			leading={<LogFoodRowLeading selection={selection} locale={locale} />}
			title={name}
			caption={
				selection.kind === "personal"
					? offProductCaption(selection.food.provenance, props.caption)
					: props.caption
			}
			value={props.quickValue}
			portion={props.quickPortion}
			position={accessibility ? props.position : "only"}
			inset={false}
			onPress={props.onPress}
			accessibilityActions={accessibility?.accessibilityActions}
			onAccessibilityAction={accessibility?.onAccessibilityAction}
			add={{
				label: props.quickLabel,
				busy: props.quickLogging,
				done: props.justLogged,
				onPress: props.onQuickLog,
			}}
		/>
	);
	return (
		<View style={[styles.cell, logFoodCellCorners(props.position)]}>
			<SwipeableRow
				actions={props.actions}
				menuTitle={name}
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

type LogFoodRowLayoutA11y = NonNullable<
	Parameters<typeof LogFoodRowLayout>[0]["onAccessibilityAction"]
>;

const styles = StyleSheet.create({
	cell: {
		marginHorizontal: spacing.md,
		overflow: "hidden",
		borderCurve: "continuous",
	},
	host: { width: "100%" },
});
