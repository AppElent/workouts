import { useState } from "react";
import {
	ActionSheetIOS,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { AppText } from "../ui/text";

/** A visible, compact entry point for secondary nutrition actions. */
export function NutritionMenu({
	label,
	closeLabel,
	actions,
}: {
	label: string;
	closeLabel: string;
	actions: readonly {
		label: string;
		onPress: () => void;
		dividerAfter?: boolean;
	}[];
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const [open, setOpen] = useState(false);
	const insets = useSafeAreaInsets();
	const reduceMotion = useReduceMotion();
	function show() {
		if (Platform.OS === "ios") {
			ActionSheetIOS.showActionSheetWithOptions(
				{
					title: label,
					options: [...actions.map((a) => a.label), closeLabel],
					cancelButtonIndex: actions.length,
				},
				(index) => actions[index]?.onPress(),
			);
		} else setOpen(true);
	}
	return (
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={label}
				onPress={show}
				style={styles.trigger}
			>
				<AppText variant="heading">···</AppText>
			</Pressable>
			<Modal
				visible={open}
				transparent
				animationType={modalAnimation(reduceMotion, "fade")}
				onRequestClose={() => setOpen(false)}
			>
				<View
					style={[
						styles.backdrop,
						{
							paddingTop: insets.top + spacing.md,
							paddingBottom: insets.bottom + spacing.md,
						},
					]}
				>
					<Pressable
						style={StyleSheet.absoluteFill}
						onPress={() => setOpen(false)}
						accessibilityRole="button"
						accessibilityLabel={closeLabel}
					/>
					<View style={styles.sheet} accessibilityViewIsModal>
						<AppText variant="heading">{label}</AppText>
						<ScrollView>
							{actions.map((action) => (
								<View key={action.label}>
									<Pressable
										accessibilityRole="button"
										onPress={() => {
											setOpen(false);
											action.onPress();
										}}
										style={styles.item}
									>
										<AppText>{action.label}</AppText>
									</Pressable>
									{action.dividerAfter ? <View style={styles.divider} /> : null}
								</View>
							))}
						</ScrollView>
						<Pressable
							accessibilityRole="button"
							onPress={() => setOpen(false)}
							style={styles.item}
						>
							<AppText style={{ color: colors.textMuted }}>
								{closeLabel}
							</AppText>
						</Pressable>
					</View>
				</View>
			</Modal>
		</>
	);
}
const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		trigger: {
			minWidth: 44,
			minHeight: 44,
			alignItems: "center",
			justifyContent: "center",
		},
		backdrop: {
			flex: 1,
			justifyContent: "flex-end",
			backgroundColor: colors.scrim,
			paddingHorizontal: spacing.md,
		},
		sheet: {
			maxHeight: "90%",
			borderRadius: radius.sheet,
			backgroundColor: colors.surface,
			padding: spacing.md,
		},
		item: {
			minHeight: 48,
			justifyContent: "center",
			paddingVertical: spacing.sm,
		},
		divider: { height: 1, backgroundColor: colors.borderStrong },
	});
