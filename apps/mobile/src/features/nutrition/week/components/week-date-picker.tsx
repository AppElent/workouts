import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTokens } from "../../../../theme";
import { WeekCalendar } from "./week-calendar";
import type { WeekDatePickerProps } from "./week-date-picker-props";

export function WeekDatePicker(props: WeekDatePickerProps) {
	const [open, setOpen] = useState(false);
	const colors = useTokens();
	const insets = useSafeAreaInsets();
	return (
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={props.label}
				onPress={() => setOpen(true)}
				style={{
					width: 44,
					height: 44,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<SymbolView name="calendar" size={22} tintColor={colors.text} />
			</Pressable>
			<Modal
				visible={open}
				transparent
				animationType="fade"
				onRequestClose={() => setOpen(false)}
			>
				<Pressable
					accessible={false}
					onPress={() => setOpen(false)}
					style={{ flex: 1, backgroundColor: colors.scrim }}
				>
					<View
						accessibilityViewIsModal
						style={{
							position: "absolute",
							top: insets.top + 48,
							left: 16,
							right: 16,
							backgroundColor: colors.surface,
							borderRadius: 24,
							padding: 8,
						}}
						onStartShouldSetResponder={() => true}
					>
						<WeekCalendar
							{...props}
							onSelect={(weekStart) => {
								props.onSelect(weekStart);
								setOpen(false);
							}}
						/>
					</View>
				</Pressable>
			</Modal>
		</>
	);
}
