import { BottomSheet, Group, Host, RNHostView } from "@expo/ui/swift-ui";
import {
	interactiveDismissDisabled,
	presentationBackground,
	presentationDetents,
	presentationDragIndicator,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";
import {
	type Tokens,
	useAppearance,
	useThemedStyles,
	useTokens,
} from "../theme";
import type { SetEditSheetPresentationProps } from "./set-edit-sheet-presentation.types";
import { SetEditorContent } from "./set-editor-content";

export function SetEditSheetPresentation(props: SetEditSheetPresentationProps) {
	const colors = useTokens();
	const { scheme } = useAppearance();
	const styles = useThemedStyles(createStyles);
	return (
		<Host
			colorScheme={scheme}
			seedColor={colors.accent}
			pointerEvents="box-none"
			style={StyleSheet.absoluteFill}
		>
			<BottomSheet
				isPresented
				onIsPresentedChange={(presented) => {
					if (!presented) props.onRequestClose();
				}}
			>
				<Group
					modifiers={[
						presentationDetents(["medium", "large"]),
						presentationDragIndicator("visible"),
						presentationBackground(colors.surface),
						interactiveDismissDisabled(props.dirty || props.busy),
					]}
				>
					<RNHostView>
						<View style={styles.content}>
							<SetEditorContent
								{...props}
								bottomInset={24}
								backgroundColor={colors.surface}
							/>
						</View>
					</RNHostView>
				</Group>
			</BottomSheet>
		</Host>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		content: { flex: 1, backgroundColor: colors.surface },
	});
