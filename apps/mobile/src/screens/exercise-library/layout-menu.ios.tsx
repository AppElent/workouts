import { Button, Host, Popover, RNHostView } from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	buttonStyle,
	frame,
	labelStyle,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { useState } from "react";
import { useI18n } from "../../i18n";
import { useAppearance } from "../../theme";
import { type LayoutMenuProps, LayoutOptions } from "./layout-options";
export function LayoutMenu(props: LayoutMenuProps) {
	const [open, setOpen] = useState(false);
	const { scheme, colors } = useAppearance();
	const { t } = useI18n();
	return (
		<Host
			ignoreSafeArea="all"
			colorScheme={scheme}
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
						label={t.exercises.layout}
						systemImage="ellipsis"
						onPress={() => setOpen(true)}
						modifiers={[
							accessibilityLabel(t.exercises.layout),
							labelStyle("iconOnly"),
							buttonStyle("plain"),
							tint(colors.accent),
							frame({ width: 44, height: 44 }),
						]}
					/>
				</Popover.Trigger>
				<Popover.Content>
					<RNHostView matchContents>
						<LayoutOptions
							{...props}
							onChange={(value) => {
								props.onChange(value);
								setOpen(false);
							}}
						/>
					</RNHostView>
				</Popover.Content>
			</Popover>
		</Host>
	);
}
