import {
	BottomSheet,
	Button,
	DatePicker,
	Group,
	Host,
	HStack,
	Spacer,
	VStack,
} from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	datePickerStyle,
	disabled,
	labelsHidden,
	padding,
	presentationBackground,
	presentationDetents,
	presentationDragIndicator,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";
import { isoDateToLocalDate, toIsoDate } from "../data/calendar-day";
import { useAppearance, useTokens } from "../theme";
import type { DatePickerSheetProps } from "./date-picker-sheet.types";

/**
 * The system date picker, in a sheet over the screen that asked for it.
 *
 * `graphical` rather than `compact`: compact renders as a field that opens its
 * own popover, which would be a second presentation inside this one. The month
 * grid is what people expect when the whole sheet exists to pick a day.
 */
export function DatePickerSheet({
	visible,
	date,
	today,
	title,
	todayLabel,
	doneLabel,
	onSelect,
	onClose,
}: DatePickerSheetProps) {
	const colors = useTokens();
	const { scheme } = useAppearance();
	return (
		<Host
			colorScheme={scheme}
			seedColor={colors.accent}
			pointerEvents="box-none"
			style={StyleSheet.absoluteFill}
		>
			<BottomSheet
				isPresented={visible}
				onIsPresentedChange={(presented) => {
					if (!presented) onClose();
				}}
			>
				<Group
					modifiers={[
						presentationDetents(["medium", "large"]),
						presentationDragIndicator("visible"),
						presentationBackground(colors.surface),
					]}
				>
					<VStack spacing={12} modifiers={[padding({ all: 16 })]}>
						<HStack>
							<Button
								label={todayLabel}
								onPress={() => onSelect(today)}
								modifiers={[disabled(date === today)]}
							/>
							<Spacer />
							<Button label={doneLabel} onPress={onClose} />
						</HStack>
						<DatePicker
							title={title}
							selection={isoDateToLocalDate(date)}
							displayedComponents={["date"]}
							onDateChange={(next) => onSelect(toIsoDate(next))}
							modifiers={[
								datePickerStyle("graphical"),
								labelsHidden(),
								accessibilityLabel(title),
							]}
						/>
					</VStack>
				</Group>
			</BottomSheet>
		</Host>
	);
}
