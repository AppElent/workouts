import { Button, Host, Popover, RNHostView } from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	buttonStyle,
	frame,
	labelStyle,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { useHostScheme, useTokens } from "../../../../theme";
import { WeekCalendar } from "./week-calendar";
import type { WeekDatePickerProps } from "./week-date-picker-props";

/** Same popover as the diary's date picker, choosing a whole week. */
export function WeekDatePicker(props: WeekDatePickerProps) {
	const [open, setOpen] = useState(false);
	const colors = useTokens();
	const { width } = useWindowDimensions();
	return (
		<Host
			ignoreSafeArea="all"
			colorScheme={useHostScheme()}
			matchContents
			style={{ width: 44, height: 44 }}
		>
			<Popover
				isPresented={open}
				onIsPresentedChange={setOpen}
				attachmentAnchor="bottom"
				arrowEdge="top"
			>
				<Popover.Trigger>
					<Button
						label={props.label}
						systemImage="calendar"
						onPress={() => setOpen(true)}
						modifiers={[
							accessibilityLabel(props.label),
							labelStyle("iconOnly"),
							buttonStyle("plain"),
							tint(colors.text),
							frame({ width: 44, height: 44 }),
						]}
					/>
				</Popover.Trigger>
				<Popover.Content>
					<RNHostView matchContents>
						<View style={{ width: Math.min(340, width - 32), padding: 8 }}>
							<WeekCalendar
								{...props}
								onSelect={(weekStart) => {
									props.onSelect(weekStart);
									setOpen(false);
								}}
							/>
						</View>
					</RNHostView>
				</Popover.Content>
			</Popover>
		</Host>
	);
}
