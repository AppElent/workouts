import { comboEditorEn, comboEditorNl } from "./combo-editor";
import { diaryEn, diaryNl } from "./diary";
import { foodEditorEn, foodEditorNl } from "./food-editor";
import { foodLibraryEn, foodLibraryNl } from "./food-library";
import { goalEditorEn, goalEditorNl } from "./goal-editor";
import { logFoodEn, logFoodNl } from "./log-food";
import {
	nutritionAssistanceEn,
	nutritionAssistanceNl,
} from "./nutrition-assistance";
import {
	nutritionAttributionEn,
	nutritionAttributionNl,
} from "./nutrition-attribution";
import { nutritionBarcodeEn, nutritionBarcodeNl } from "./nutrition-barcode";
import { nutritionCombosEn, nutritionCombosNl } from "./nutrition-combos";
import { nutritionDayEn, nutritionDayNl } from "./nutrition-day";
import { nutritionDraftsEn, nutritionDraftsNl } from "./nutrition-drafts";
import {
	nutritionEntryActionsEn,
	nutritionEntryActionsNl,
} from "./nutrition-entry-actions";
import {
	nutritionEntryEditorEn,
	nutritionEntryEditorNl,
} from "./nutrition-entry-editor";
import { nutritionErrorEn, nutritionErrorNl } from "./nutrition-error";
import {
	nutritionFoodBrowserEn,
	nutritionFoodBrowserNl,
} from "./nutrition-food-browser";
import {
	nutritionFoodImportEn,
	nutritionFoodImportNl,
} from "./nutrition-food-import";
import { nutritionForkEn, nutritionForkNl } from "./nutrition-fork";
import { nutritionGoalsEn, nutritionGoalsNl } from "./nutrition-goals";
import { nutritionMealsEn, nutritionMealsNl } from "./nutrition-meals";
import {
	nutritionNutrientsEn,
	nutritionNutrientsNl,
} from "./nutrition-nutrients";
import { nutritionOfflineEn, nutritionOfflineNl } from "./nutrition-offline";
import {
	nutritionPersonalFoodEn,
	nutritionPersonalFoodNl,
} from "./nutrition-personal-food";
import {
	nutritionPersonalMeasuresEn,
	nutritionPersonalMeasuresNl,
} from "./nutrition-personal-measures";
import { nutritionSettingsEn, nutritionSettingsNl } from "./nutrition-settings";
import {
	nutritionTrainingMarkerEn,
	nutritionTrainingMarkerNl,
} from "./nutrition-training-marker";
import { nutritionUnitsEn, nutritionUnitsNl } from "./nutrition-units";
import { oneOffLogEn, oneOffLogNl } from "./one-off-log";
import { weekReviewEn, weekReviewNl } from "./week-review";
export const nutritionEn = {
	personalMeasures: nutritionPersonalMeasuresEn,
	day: nutritionDayEn,
	trainingMarker: nutritionTrainingMarkerEn,
	goals: nutritionGoalsEn,
	week: weekReviewEn,
	library: foodLibraryEn,
	foodEditor: foodEditorEn,
	comboEditor: comboEditorEn,
	assistance: nutritionAssistanceEn,
	diary: diaryEn,
	logFood: logFoodEn,
	oneOff: oneOffLogEn,
	settings: nutritionSettingsEn,
	goalEditor: goalEditorEn,
	meals: nutritionMealsEn,
	/** The accessible name of a meal slot's icon-only plus control. */
	addTo: "Add food to {meal}",
	mealEmpty: "Nothing logged yet. Use + to add a food.",
	drafts: nutritionDraftsEn,
	foodBrowser: nutritionFoodBrowserEn,
	barcode: nutritionBarcodeEn,
	foodImport: nutritionFoodImportEn,
	personalFood: nutritionPersonalFoodEn,
	combos: nutritionCombosEn,
	fork: nutritionForkEn,
	offline: nutritionOfflineEn,
	entryActions: nutritionEntryActionsEn,
	entryEditor: nutritionEntryEditorEn,
	nutrients: nutritionNutrientsEn,
	units: nutritionUnitsEn,
	attribution: nutritionAttributionEn,
	error: nutritionErrorEn,
};

export const nutritionNl: typeof nutritionEn = {
	personalMeasures: nutritionPersonalMeasuresNl,
	day: nutritionDayNl,
	trainingMarker: nutritionTrainingMarkerNl,
	goals: nutritionGoalsNl,
	week: weekReviewNl,
	library: foodLibraryNl,
	foodEditor: foodEditorNl,
	comboEditor: comboEditorNl,
	assistance: nutritionAssistanceNl,
	diary: diaryNl,
	logFood: logFoodNl,
	oneOff: oneOffLogNl,
	settings: nutritionSettingsNl,
	goalEditor: goalEditorNl,
	meals: nutritionMealsNl,
	addTo: "Voeg eten toe aan {meal}",
	mealEmpty: "Nog niets gelogd. Gebruik + om eten toe te voegen.",
	drafts: nutritionDraftsNl,
	foodBrowser: nutritionFoodBrowserNl,
	barcode: nutritionBarcodeNl,
	foodImport: nutritionFoodImportNl,
	personalFood: nutritionPersonalFoodNl,
	combos: nutritionCombosNl,
	fork: nutritionForkNl,
	offline: nutritionOfflineNl,
	entryActions: nutritionEntryActionsNl,
	entryEditor: nutritionEntryEditorNl,
	nutrients: nutritionNutrientsNl,
	units: nutritionUnitsNl,
	attribution: nutritionAttributionNl,
	error: nutritionErrorNl,
};
