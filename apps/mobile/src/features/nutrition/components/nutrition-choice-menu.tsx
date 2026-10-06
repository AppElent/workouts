import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { radius, spacing, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";
import type { NutritionChoiceMenuProps } from "./nutrition-choice-menu-props";

/** Android and web: the same items in a modal list until a Compose menu is verified. */
export function NutritionChoiceMenu({
	accessibilityLabel,
	title,
	sections,
	onSelect,
	disabled,
	children,
	style,
}: NutritionChoiceMenuProps) {
	const [open, setOpen] = useState(false);
	const colors = useTokens();
	return (
		<>
			<Pressable
				disabled={disabled}
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel}
				accessibilityState={{ disabled: Boolean(disabled) }}
				onPress={() => setOpen(true)}
				style={style}
			>
				{children}
			</Pressable>
			<Modal
				visible={open}
				transparent
				animationType="fade"
				onRequestClose={() => setOpen(false)}
			>
				<Pressable
					accessibilityLabel={accessibilityLabel}
					onPress={() => setOpen(false)}
					style={{
						flex: 1,
						justifyContent: "center",
						padding: spacing.lg,
						backgroundColor: colors.scrim,
					}}
				>
					<View
						accessibilityViewIsModal
						style={{
							backgroundColor: colors.surface,
							borderRadius: radius.sheet,
							padding: spacing.md,
							maxHeight: "80%",
						}}
					>
						<ScrollView>
							{title ? <AppText variant="caption">{title}</AppText> : null}
							{sections.map((items, index) => (
								<View
									key={items[0]?.id ?? index}
									style={
										index > 0
											? {
													borderTopWidth: 0.5,
													borderTopColor: colors.separator,
												}
											: undefined
									}
								>
									{items.map((item) => (
										<Pressable
											key={item.id}
											accessibilityRole="button"
											accessibilityState={{ selected: item.selected }}
											onPress={() => {
												setOpen(false);
												onSelect(item.id);
											}}
											style={{ minHeight: 48, justifyContent: "center" }}
										>
											<AppText
												style={
													item.destructive
														? { color: colors.danger }
														: undefined
												}
											>
												{item.selected ? "✓ " : ""}
												{item.label}
											</AppText>
											{item.hint ? (
												<AppText variant="caption">{item.hint}</AppText>
											) : null}
										</Pressable>
									))}
								</View>
							))}
						</ScrollView>
					</View>
				</Pressable>
			</Modal>
		</>
	);
}
