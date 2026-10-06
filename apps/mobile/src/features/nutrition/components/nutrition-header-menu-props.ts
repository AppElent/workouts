export interface NutritionHeaderMenuProps {
	label: string;
	selectLabel?: string;
	onSelect?: () => void;
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
