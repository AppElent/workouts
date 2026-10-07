import { type ReactNode, useEffect, useRef } from "react";
import { Modal } from "react-native";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";

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
	const reduceMotion = useReduceMotion();
	const shown = useRef(visible);
	// Android's Modal has no dismiss callback; hiding it is the moment.
	useEffect(() => {
		if (shown.current && !visible) onDismissed?.();
		shown.current = visible;
	}, [visible, onDismissed]);
	return (
		<Modal
			visible={visible}
			presentationStyle="pageSheet"
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={onClose}
		>
			{children}
		</Modal>
	);
}
