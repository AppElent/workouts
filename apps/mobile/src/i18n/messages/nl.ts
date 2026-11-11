import { accountNl } from "./account";
import { activityNl } from "./activity";
import { appearanceNl } from "./appearance";
import { authErrorsNl } from "./auth-errors";
import { bodyMetricsNl } from "./body-metrics";
import { commonNl } from "./common";
import type { en } from "./en";
import { enduranceNl } from "./endurance";
import { entryEditorNl } from "./entry-editor";
import { errorsNl } from "./errors";
import { exerciseLibraryNl } from "./exercise-library";
import { feedbackNl } from "./feedback";
import { firstRunNl } from "./first-run";
import { hostedNl } from "./hosted";
import { languageNl } from "./language";
import { localDataNl } from "./local-data";
import { nutritionNl } from "./nutrition";
import { preferencesNl } from "./preferences";
import { profileNl } from "./profile";
import { progressNl } from "./progress";
import { routesNl } from "./routes";
import { signInNl } from "./sign-in";
import { signUpNl } from "./sign-up";
import { strengthNl } from "./strength";
import { tabsNl } from "./tabs";
import { testDataNl } from "./test-data";
import { trainingNl } from "./training";
import { verifyEmailNl } from "./verify-email";
import { wodsNl } from "./wods";
import { workoutSummaryNl } from "./workout-summary";
import { workoutToolsNl } from "./workout-tools";
/** Dutch, assembled from the same namespace files as `en.ts`. */
export const nl = {
	testData: testDataNl,
	wods: wodsNl,
	workoutSummary: workoutSummaryNl,
	progress: progressNl,
	bodyMetrics: bodyMetricsNl,
	hosted: hostedNl,
	workoutTools: workoutToolsNl,
	signIn: signInNl,
	authErrors: authErrorsNl,
	signUp: signUpNl,
	verifyEmail: verifyEmailNl,
	profile: profileNl,
	account: accountNl,
	training: trainingNl,
	strength: strengthNl,
	diaryEntry: entryEditorNl,
	exercises: exerciseLibraryNl,
	activity: activityNl,
	endurance: enduranceNl,
	localData: localDataNl,
	tabs: tabsNl,
	routes: routesNl,
	feedback: feedbackNl,
	common: commonNl,
	errors: errorsNl,
	preferences: preferencesNl,
	appearance: appearanceNl,
	language: languageNl,
	nutrition: nutritionNl,
	firstRun: firstRunNl,
} satisfies typeof en;
