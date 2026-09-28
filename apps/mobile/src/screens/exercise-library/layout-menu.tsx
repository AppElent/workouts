import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useI18n } from "../../i18n";
import { useTokens } from "../../theme";
import { AppText } from "../../ui/text";
import { type LayoutMenuProps, LayoutOptions } from "./layout-options";
export function LayoutMenu(props: LayoutMenuProps) {
	const [open, setOpen] = useState(false);
	const colors = useTokens();
	const { t } = useI18n();
	return (
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t.exercises.layout}
				onPress={() => setOpen(true)}
				style={{
					width: 48,
					height: 48,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<AppText style={{ color: colors.accent }}>•••</AppText>
			</Pressable>
			<Modal
				transparent
				visible={open}
				animationType="fade"
				onRequestClose={() => setOpen(false)}
			>
				<Pressable
					accessibilityLabel={t.exercises.cancel}
					onPress={() => setOpen(false)}
					style={{
						flex: 1,
						backgroundColor: colors.scrim,
						alignItems: "flex-end",
						paddingTop: 64,
						paddingRight: 16,
					}}
				>
					<View style={{ backgroundColor: colors.surface, borderRadius: 20 }}>
						<LayoutOptions
							{...props}
							onChange={(value) => {
								props.onChange(value);
								setOpen(false);
							}}
						/>
					</View>
				</Pressable>
			</Modal>
		</>
	);
}
