import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { radius, spacing, type Tokens, useThemedStyles } from "../theme";
import type { FoodVisualMenuProps } from "./food-visual-menu.types";
import { AppText } from "./text";

export function FoodVisualMenu<Value extends string>({
	label,
	options,
	selectedValue,
	onSelect,
}: FoodVisualMenuProps<Value>) {
	const styles = useThemedStyles(createStyles);
	const [open, setOpen] = useState(false);
	return (
		<>
			<Pressable
				onPress={() => setOpen(true)}
				accessibilityRole="button"
				style={styles.trigger}
			>
				<AppText style={styles.triggerLabel}>{label}</AppText>
			</Pressable>
			<Modal
				visible={open}
				transparent
				animationType="fade"
				onRequestClose={() => setOpen(false)}
			>
				<Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
					<View style={styles.popup} accessibilityViewIsModal>
						<ScrollView>
							{options.map((option) => (
								<Pressable
									key={option.value}
									onPress={() => {
										setOpen(false);
										onSelect(option.value);
									}}
									style={styles.option}
								>
									<AppText>{option.label}</AppText>
									{option.value === selectedValue ? <AppText>✓</AppText> : null}
								</Pressable>
							))}
						</ScrollView>
					</View>
				</Pressable>
			</Modal>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		trigger: { minHeight: 48, justifyContent: "center" },
		triggerLabel: { color: colors.accent, fontWeight: "700" },
		backdrop: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
			padding: spacing.xl,
			backgroundColor: colors.scrim,
		},
		popup: {
			width: "100%",
			maxWidth: 360,
			maxHeight: "70%",
			borderRadius: radius.lg,
			backgroundColor: colors.surface,
			padding: spacing.sm,
		},
		option: {
			minHeight: 48,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingHorizontal: spacing.md,
		},
	});
