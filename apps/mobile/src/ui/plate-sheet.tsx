import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { radius, spacing, type Tokens, useThemedStyles } from "../theme";
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
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const reduceMotion = useReduceMotion();

	return (
		<Modal
			visible={visible}
			transparent
			presentationStyle="overFullScreen"
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={onClose}
		>
			<Pressable style={styles.backdrop} onPress={onClose}>
				<Pressable
					style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
					onPress={() => {}}
				>
					<View style={styles.grabber} />
					<PlateSheetContent weight={weight} onClose={onClose} />
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		backdrop: {
			flex: 1,
			justifyContent: "flex-end",
			backgroundColor: colors.scrim,
		},
		sheet: {
			maxHeight: "80%",
			gap: spacing.sm,
			backgroundColor: colors.surface,
			borderTopLeftRadius: radius.sheet,
			borderTopRightRadius: radius.sheet,
			paddingHorizontal: spacing.md,
			paddingTop: spacing.sm,
		},
		grabber: {
			alignSelf: "center",
			width: 36,
			height: 4,
			borderRadius: radius.pill,
			backgroundColor: colors.borderStrong,
		},
	});
