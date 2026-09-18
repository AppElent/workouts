export interface NutritionHeaderMenuProps {
	label: string;
	closeLabel: string;
	weekOverviewLabel: string;
	createComboLabel: string;
	logComboLabel: string;
	captureDraftsLabel: string;
	assistanceLabel: string;
	backupLabel: string;
	goalsLabel: string;
	dataSourcesLabel: string;
	onCreateCombo: () => void;
	onOpenWeekOverview: () => void;
	onLogCombo: () => void;
	onOpenCaptureDrafts: () => void;
	onOpenAssistance: () => void;
	onOpenBackup: () => void;
	onOpenGoals: () => void;
	onToggleDataSources: () => void;
}
