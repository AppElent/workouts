export interface NutritionHeaderMenuProps {
	label: string;
	closeLabel: string;
	weekOverviewLabel: string;
	foodLibraryLabel: string;
	settingsLabel: string;
	assistanceLabel: string;
	goalsLabel: string;
	dataSourcesLabel: string;
	onOpenWeekOverview: () => void;
	onOpenFoodLibrary: () => void;
	onOpenSettings: () => void;
	onOpenAssistance: () => void;
	onOpenGoals: () => void;
	onToggleDataSources: () => void;
}
