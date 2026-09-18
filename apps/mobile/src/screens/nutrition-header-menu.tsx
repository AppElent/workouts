import type { NutritionHeaderMenuProps } from "./nutrition-header-menu.types";
import { NutritionMenu } from "./nutrition-menu";

/** Android keeps the existing accessible overflow presentation. */
export function NutritionHeaderMenu(props: NutritionHeaderMenuProps) {
	return (
		<NutritionMenu
			label={props.label}
			closeLabel={props.closeLabel}
			actions={[
				{
					label: props.weekOverviewLabel,
					onPress: props.onOpenWeekOverview,
					dividerAfter: true,
				},
				{ label: props.foodLibraryLabel, onPress: props.onOpenFoodLibrary },
				{ label: props.assistanceLabel, onPress: props.onOpenAssistance },
				{ label: props.goalsLabel, onPress: props.onOpenGoals },
				{
					label: props.dataSourcesLabel,
					onPress: props.onToggleDataSources,
					dividerAfter: true,
				},
				{ label: props.settingsLabel, onPress: props.onOpenSettings },
			]}
		/>
	);
}
