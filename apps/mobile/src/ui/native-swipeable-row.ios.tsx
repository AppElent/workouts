import { Button, Host, RNHostView, SwipeActions } from "@expo/ui/swift-ui";
import { type Href, Link } from "expo-router";
import { type ReactElement, useMemo } from "react";
import type { AccessibilityActionEvent } from "react-native";
import { StyleSheet } from "react-native";
import { useAppearance, useTokens } from "../theme";
import type { RowAccessibilityProps, RowAction } from "./swipeable-row";

/**
 * iOS canary for native row interactions. Only Exercises imports this module;
 * the rest of the app keeps the proven Gesture Handler row until device QA.
 */
export function NativeSwipeableRow({
	href,
	actions,
	menuTitle,
	children,
}: {
	href?: Href;
	actions: readonly RowAction[];
	menuTitle: string;
	closeMenuLabel: string;
	showMenuButton?: boolean;
	children: (accessibility: RowAccessibilityProps) => ReactElement;
}) {
	const colors = useTokens();
	const { scheme } = useAppearance();
	const swipeActions = actions
		.filter((action) => action.swipe !== false)
		.slice(0, 2);
	const accessibility = useMemo<RowAccessibilityProps>(
		() => ({
			accessibilityActions: actions.map((action) => ({
				name: action.key,
				label: action.label,
			})),
			onAccessibilityAction: (event: AccessibilityActionEvent) => {
				actions
					.find((action) => action.key === event.nativeEvent.actionName)
					?.onPress();
			},
			...(href ? { onPress: undefined, onLongPress: undefined } : {}),
		}),
		[actions, href],
	);

	const row = (
		<Host
			colorScheme={scheme}
			seedColor={colors.accent}
			matchContents={{ vertical: true }}
			style={styles.host}
		>
			<SwipeActions>
				<RNHostView matchContents>{children(accessibility)}</RNHostView>
				<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
					{swipeActions.map((action) => (
						<Button
							key={action.key}
							label={action.label}
							role={action.destructive ? "destructive" : "default"}
							systemImage={action.destructive ? "trash" : "arrow.right"}
							onPress={action.onPress}
						/>
					))}
				</SwipeActions.Actions>
			</SwipeActions>
		</Host>
	);

	if (!href) return row;

	return (
		<Link href={href} asChild>
			<Link.Trigger>{row}</Link.Trigger>
			<Link.Menu title={menuTitle}>
				{actions.map((action) => (
					<Link.MenuAction
						key={action.key}
						title={action.label}
						destructive={action.destructive}
						onPress={action.onPress}
					/>
				))}
			</Link.Menu>
		</Link>
	);
}

const styles = StyleSheet.create({
	host: { width: "100%" },
});
