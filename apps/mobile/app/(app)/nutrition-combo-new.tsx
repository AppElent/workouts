export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

/**
 * Route for saving selected diary entries (or library foods) as a Combo.
 *
 * The selection travels as comma-joined ids, resolved again on arrival: ids
 * survive a navigation, objects carried through one go stale. Diary ids that no
 * longer match anything are dropped, and an empty selection closes the route.
 */
import { router, useLocalSearchParams } from "expo-router";
import {
	ComboNewFromDiary,
	ComboNewFromLibrary,
} from "../../src/features/nutrition/combo/combo-new-sources";
import { diaryRouteParams } from "../../src/features/nutrition/diary-route-params";

const ids = (value?: string) => (value ?? "").split(",").filter(Boolean);
const leave = () => router.back();

export default function NutritionComboNewRoute() {
	const params = useLocalSearchParams<{
		foodIds?: string;
		date?: string;
		entryIds?: string;
	}>();
	const { foodIds, entryIds } = params;
	return foodIds ? (
		<ComboNewFromLibrary foodIds={ids(foodIds)} />
	) : (
		<ComboNewFromDiary
			date={diaryRouteParams(params).date}
			entryIds={ids(entryIds)}
			onDone={leave}
		/>
	);
}
