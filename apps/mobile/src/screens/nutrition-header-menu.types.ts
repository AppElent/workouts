export interface NutritionHeaderMenuProps {
	label: string;
	closeLabel: string;
	createComboLabel: string;
	logComboLabel: string;
	captureDraftsLabel: string;
	assistanceLabel: string;
	backupLabel: string;
	goalsLabel: string;
	dataSourcesLabel: string;
	onCreateCombo: () => void;
	onLogCombo: () => void;
	onOpenCaptureDrafts: () => void;
	onOpenAssistance: () => void;
	onOpenBackup: () => void;
	onOpenGoals: () => void;
	onToggleDataSources: () => void;
}
