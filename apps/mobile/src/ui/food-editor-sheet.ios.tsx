import { BottomSheet, Group, Host, RNHostView } from "@expo/ui/swift-ui";
import {
	presentationBackground,
	presentationDetents,
	presentationDragIndicator,
} from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors, useHostScheme } from "../theme";

export function FoodEditorSheet({
	visible,
	onClose,
	children,
}: {
	visible: boolean;
	onClose: () => void;
	children: ReactNode;
}) {
	return (
		<Host
			colorScheme={useHostScheme()}
			seedColor={colors.accent}
			pointerEvents="box-none"
			style={StyleSheet.absoluteFill}
		>
			<BottomSheet
				isPresented={visible}
				onIsPresentedChange={(presented) => {
					if (!presented) onClose();
				}}
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
