import { Button, Divider, Host, Image, Menu } from "@expo/ui/swift-ui";
import { accessibilityLabel } from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";
import { colors } from "../theme";
import type { NutritionHeaderMenuProps } from "./nutrition-header-menu.types";

/** A purpose-built SwiftUI toolbar menu; the feature still owns every handler. */
export function NutritionHeaderMenu(props: NutritionHeaderMenuProps) {
	return (
		<Host colorScheme="dark" seedColor={colors.accent} style={styles.host}>
			<Menu
				label={<Image systemName="ellipsis.circle" size={22} />}
				modifiers={[accessibilityLabel(props.label)]}
			>
				<Button
					label={props.weekOverviewLabel}
					systemImage="chart.bar.xaxis"
					onPress={props.onOpenWeekOverview}
				/>
				<Divider />
				<Button
					label={props.foodLibraryLabel}
					systemImage="books.vertical"
					onPress={props.onOpenFoodLibrary}
				/>
				<Button
					label={props.assistanceLabel}
					systemImage="text.viewfinder"
					onPress={props.onOpenAssistance}
				/>
				<Divider />
				<Button
					label={props.goalsLabel}
					systemImage="target"
					onPress={props.onOpenGoals}
				/>
				<Button
					label={props.dataSourcesLabel}
					systemImage="info.circle"
					onPress={props.onToggleDataSources}
				/>
				<Divider />
				<Button
					label={props.settingsLabel}
					systemImage="gearshape"
					onPress={props.onOpenSettings}
				/>
			</Menu>
		</Host>
	);
}

const styles = StyleSheet.create({
	host: { width: 44, height: 44 },
});
