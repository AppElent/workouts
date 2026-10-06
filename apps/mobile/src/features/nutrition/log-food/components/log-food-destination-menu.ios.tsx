import {
	Button,
	Divider,
	Host,
	Menu,
	RNHostView,
	Section,
} from "@expo/ui/swift-ui";
import { accessibilityLabel } from "@expo/ui/swift-ui/modifiers";
import { SymbolView } from "expo-symbols";
import { StyleSheet, View } from "react-native";
import { useHostScheme, useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";
import type { LogFoodDestinationMenuProps } from "./log-food-destination-menu-props";

/**
 * A SwiftUI `Menu` as the navigation title: "Lunch ⌄" over the day.
 *
 * The label is React Native content in an `RNHostView` (the diary meal menu's
 * idiom) so it uses the app's type ramp; the menu itself is the system's.
 */
export function LogFoodDestinationMenu(props: LogFoodDestinationMenuProps) {
	const colors = useTokens();
	return (
		<Host matchContents colorScheme={useHostScheme()} style={styles.host}>
			<Menu
				label={
					<RNHostView matchContents>
						<View style={styles.title}>
							<View style={styles.row}>
								<AppText variant="navTitle">{props.mealName}</AppText>
								<SymbolView
									name="chevron.down"
									size={11}
									weight="semibold"
									tintColor={colors.textMuted}
								/>
							</View>
							<AppText variant="caption">{props.dayLabel}</AppText>
						</View>
					</RNHostView>
				}
				modifiers={[accessibilityLabel(props.label)]}
			>
				<Section title={props.sectionTitle}>
					{props.options.map((option) => (
						<Button
							key={option.slot}
							label={option.label}
							systemImage={option.selected ? "checkmark" : undefined}
							onPress={() => props.onSelectMeal(option.slot)}
						/>
					))}
				</Section>
				<Divider />
				<Button
					label={props.otherDayLabel}
					systemImage="calendar"
					onPress={props.onOtherDay}
				/>
			</Menu>
		</Host>
	);
}

const styles = StyleSheet.create({
	host: { minHeight: 44 },
	title: { alignItems: "center", justifyContent: "center", minHeight: 44 },
	row: { flexDirection: "row", alignItems: "center", gap: 4 },
});
