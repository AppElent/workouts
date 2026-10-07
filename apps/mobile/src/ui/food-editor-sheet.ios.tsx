import { BottomSheet, Group, Host, RNHostView } from "@expo/ui/swift-ui";
import {
	presentationBackground,
	presentationDetents,
	presentationDragIndicator,
} from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useAppearance, useTokens } from "../theme";

export function FoodEditorSheet({
	visible,
	onClose,
	onDismissed,
	children,
}: {
	visible: boolean;
	onClose: () => void;
	/** After the sheet is fully gone: the moment another sheet may present. */
	onDismissed?: () => void;
	children: ReactNode;
}) {
	const colors = useTokens();
	const { scheme } = useAppearance();
	return (
		<Host
			colorScheme={scheme}
			seedColor={colors.accent}
			pointerEvents="box-none"
			style={StyleSheet.absoluteFill}
		>
			<BottomSheet
				isPresented={visible}
				onIsPresentedChange={(presented) => {
					if (!presented) onClose();
				}}
				onDismiss={onDismissed}
			>
				<Group
					modifiers={[
						presentationDetents(["large"]),
						presentationDragIndicator("visible"),
						presentationBackground(colors.bg),
					]}
				>
					<RNHostView>
						<View style={styles.content}>{children}</View>
					</RNHostView>
				</Group>
			</BottomSheet>
		</Host>
	);
}

const styles = StyleSheet.create({ content: { flex: 1 } });
