import {
	Button,
	ContextMenu,
	Divider,
	Host,
	RNHostView,
} from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";
import { useWindowDimensions, View } from "react-native";
import { useHostScheme, useTokens } from "../../../../theme";
import type { GoalRowMenuProps } from "./goal-row-menu";
export function GoalRowMenu({
	children,
	onSources,
	onEdit,
	onReorder,
	sourcesLabel,
	editLabel,
	reorderLabel,
	disabled,
}: GoalRowMenuProps) {
	const scheme = useHostScheme();
	const colors = useTokens();
	const { width } = useWindowDimensions();
	if (disabled) return children();
	return (
		<Host
			matchContents={{ vertical: true }}
			colorScheme={scheme}
			style={{ width: width - 64 }}
		>
			<ContextMenu modifiers={[frame({ width: width - 64 })]}>
				<ContextMenu.Items>
					{onSources ? (
						<Button
							label={sourcesLabel}
							systemImage="chart.bar.xaxis"
							onPress={onSources}
						/>
					) : null}
					<Button label={editLabel} systemImage="target" onPress={onEdit} />
					{onReorder ? (
						<>
							<Divider />
							<Button
								label={reorderLabel}
								systemImage="arrow.up.arrow.down"
								onPress={onReorder}
							/>
						</>
					) : null}
				</ContextMenu.Items>
				<ContextMenu.Trigger>
					<RNHostView matchContents>
						<View style={{ width: width - 64 }}>{children()}</View>
					</RNHostView>
				</ContextMenu.Trigger>
				<ContextMenu.Preview>
					<RNHostView matchContents>
						<View
							style={{
								width: width - 64,
								padding: 16,
								borderRadius: 24,
								backgroundColor: colors.surface,
							}}
						>
							{children()}
						</View>
					</RNHostView>
				</ContextMenu.Preview>
			</ContextMenu>
		</Host>
	);
}
