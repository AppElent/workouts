export interface NutritionHeaderMenuProps {
	label: string;
	closeLabel: string;
	createComboLabel: string;
	logComboLabel: string;
	recipesLabel: string;
	assistanceLabel: string;
	backupLabel: string;
	goalsLabel: string;
	dataSourcesLabel: string;
	onCreateCombo: () => void;
	onLogCombo: () => void;
	onOpenRecipes: () => void;
	onOpenAssistance: () => void;
	onOpenBackup: () => void;
	onOpenGoals: () => void;
	onToggleDataSources: () => void;
}
