import { BottomSheet, Group, Host, RNHostView } from "@expo/ui/swift-ui";
import {
	presentationBackground,
	presentationDetents,
	presentationDragIndicator,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { PlateSheetContent } from "./plate-sheet-content";

export function PlateSheet({
	visible,
	weight,
	onClose,
}: {
	visible: boolean;
	weight: number;
	onClose: () => void;
}) {
	return (
		<Host
			colorScheme="dark"
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
						presentationDetents(["medium", "large"]),
						presentationDragIndicator("visible"),
						presentationBackground(colors.surface),
					]}
				>
					<RNHostView>
						<View style={styles.content}>
							<PlateSheetContent weight={weight} onClose={onClose} />
						</View>
					</RNHostView>
				</Group>
			</BottomSheet>
		</Host>
	);
}

const styles = StyleSheet.create({
	content: {
		flex: 1,
		backgroundColor: colors.surface,
		paddingHorizontal: 16,
		paddingTop: 8,
	},
});
