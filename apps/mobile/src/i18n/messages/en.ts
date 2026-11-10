import { accountEn } from "./account";
import { activityEn } from "./activity";
import { appearanceEn } from "./appearance";
import { authErrorsEn } from "./auth-errors";
import { bodyMetricsEn } from "./body-metrics";
import { commonEn } from "./common";
import { enduranceEn } from "./endurance";
import { entryEditorEn } from "./entry-editor";
import { exerciseLibraryEn } from "./exercise-library";
import { exercisesUnavailableEn } from "./exercises-unavailable";
import { feedbackEn } from "./feedback";
import { hostedEn } from "./hosted";
import { languageEn } from "./language";
import { localDataEn } from "./local-data";
import { nutritionEn } from "./nutrition";
import { preferencesEn } from "./preferences";
import { profileEn } from "./profile";
import { progressEn } from "./progress";
import { routesEn } from "./routes";
import { signInEn } from "./sign-in";
import { signUpEn } from "./sign-up";
import { strengthEn } from "./strength";
import { tabsEn } from "./tabs";
import { testDataEn } from "./test-data";
import { trainingEn } from "./training";
import { verifyEmailEn } from "./verify-email";
import { wodsEn } from "./wods";
import { workoutSummaryEn } from "./workout-summary";
import { workoutToolsEn } from "./workout-tools";
/**
 * The phone's words. Each namespace lives in its own file holding both
 * languages: `xEn`, then `xNl: typeof xEn`, so a key missing in Dutch fails
 * `pnpm --filter @foundry/mobile typecheck` instead of showing a blank label.
 *
 * Deliberately not shared with the web app's `src/lib/i18n/messages/`. There is
 * no web Nutrition UI (it is out of scope in the spec), so sharing would buy
 * nothing and would couple the two clients' release cadence.
 *
 * No `as const`. The literal types it would produce are exactly what stops
 * the Dutch objects from satisfying this shape.
 */
export const en = {
	testData: testDataEn,
	wods: wodsEn,
	workoutSummary: workoutSummaryEn,
	progress: progressEn,
	bodyMetrics: bodyMetricsEn,
	hosted: hostedEn,
	workoutTools: workoutToolsEn,
	signIn: signInEn,
	authErrors: authErrorsEn,
	signUp: signUpEn,
	verifyEmail: verifyEmailEn,
	profile: profileEn,
	account: accountEn,
	training: trainingEn,
	strength: strengthEn,
	diaryEntry: entryEditorEn,
	exercises: exerciseLibraryEn,
	activity: activityEn,
	endurance: enduranceEn,
	localData: localDataEn,
	tabs: tabsEn,
	routes: routesEn,
	feedback: feedbackEn,
	common: commonEn,
	exercisesUnavailable: exercisesUnavailableEn,
	preferences: preferencesEn,
	appearance: appearanceEn,
	language: languageEn,
	nutrition: nutritionEn,
};

/** The shape every locale has to provide. */
export type Messages = typeof en;
