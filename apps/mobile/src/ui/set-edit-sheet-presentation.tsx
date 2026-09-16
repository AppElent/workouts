import { Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { colors } from "../theme";
import type { SetEditSheetPresentationProps } from "./set-edit-sheet-presentation.types";
import { SetEditorContent } from "./set-editor-content";

export function SetEditSheetPresentation(props: SetEditSheetPresentationProps) {
	const insets = useSafeAreaInsets();
	const reduceMotion = useReduceMotion();
	return (
		<Modal
			visible
			presentationStyle="pageSheet"
			animationType={modalAnimation(reduceMotion, "slide")}
			allowSwipeDismissal={!props.dirty && !props.busy}
			onRequestClose={props.onRequestClose}
		>
			<SetEditorContent
				{...props}
				bottomInset={insets.bottom}
				backgroundColor={colors.surface}
			/>
		</Modal>
	);
}
