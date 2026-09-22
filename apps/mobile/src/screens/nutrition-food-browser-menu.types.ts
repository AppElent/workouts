/**
 * The four authoring actions behind the + in the food browser's control row.
 *
 * They are a *menu*, not another band of page: the redesign's note was that a
 * panel which pushes the result list down costs more than four choices are
 * worth. iOS gets a real `UIMenu` anchored to the button; Android gets the
 * app's existing sheet presentation.
 */
export interface FoodBrowserMenuProps {
	label: string;
	closeLabel: string;
	logOnceLabel: string;
	newFoodLabel: string;
	newRecipeLabel: string;
	saveAsNoteLabel: string;
	/** Saving the query as a note is only offered when there is a query to save. */
	canSaveAsNote: boolean;
	onLogOnce: () => void;
	onNewFood: () => void;
	onNewRecipe: () => void;
	onSaveAsNote: () => void;
}
