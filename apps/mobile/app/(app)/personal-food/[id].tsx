/**
 * A Personal Food or recipe opened from the Library: pushed, with its own
 * header and back gesture instead of a screen inside a screen.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { usePersonalFoods } from "../../../src/data/personal-foods";
import { PersonalFoodEditor } from "../../../src/screens/personal-food-editor";

export { ErrorBoundary } from "../nutrition-library";

export default function PersonalFoodRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const library = usePersonalFoods();
	const food = id ? library.find(id) : undefined;
	useEffect(() => {
		if (!food) router.back();
	}, [food]);
	if (!food) return null;
	return (
		<PersonalFoodEditor
			food={food}
			onCancel={() => router.back()}
			onSaved={() => router.back()}
		/>
	);
}
