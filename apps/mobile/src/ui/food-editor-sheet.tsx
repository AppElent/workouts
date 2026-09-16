import type { ReactNode } from "react";
import { Modal } from "react-native";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";

export function FoodEditorSheet({
	visible,
	onClose,
	children,
}: {
	visible: boolean;
	onClose: () => void;
	children: ReactNode;
}) {
	const reduceMotion = useReduceMotion();
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
