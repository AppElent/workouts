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
				{ label: props.createComboLabel, onPress: props.onCreateCombo },
				{ label: props.logComboLabel, onPress: props.onLogCombo },
				{ label: props.recipesLabel, onPress: props.onOpenRecipes },
				{ label: props.assistanceLabel, onPress: props.onOpenAssistance },
				{ label: props.backupLabel, onPress: props.onOpenBackup },
				{ label: props.goalsLabel, onPress: props.onOpenGoals },
				{
					label: props.dataSourcesLabel,
					onPress: props.onToggleDataSources,
				},
			]}
		/>
	);
}
