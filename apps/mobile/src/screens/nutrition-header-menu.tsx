import type { NutritionHeaderMenuProps } from "./nutrition-header-menu.types";
import { NutritionMenu } from "./nutrition-menu";

/** Android keeps the existing accessible overflow presentation. */
export function NutritionHeaderMenu(props: NutritionHeaderMenuProps) {
	return (
		<NutritionMenu
			label={props.label}
			closeLabel={props.closeLabel}
			actions={[
				{ label: props.createComboLabel, onPress: props.onCreateCombo },
				{ label: props.logComboLabel, onPress: props.onLogCombo },
				{ label: props.captureDraftsLabel, onPress: props.onOpenCaptureDrafts },
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
