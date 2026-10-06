import { getShippedFood } from "@workouts/core/nutrition";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Pressable } from "react-native";
import { usePersonalFoods } from "../../src/data/personal-foods";
import { FoodViewScreen } from "../../src/features/nutrition/food/food-view-screen";
import { useI18n } from "../../src/i18n";
import { AppText } from "../../src/ui/text";
export default function NutritionFoodDetailsRoute() {
	const { id, source } = useLocalSearchParams<{
		id?: string;
		source?: string;
	}>();
	const foods = usePersonalFoods();
	const { t } = useI18n();
	const food =
		typeof id === "string"
			? source === "shipped"
				? getShippedFood(id)
				: source === "personal" || source === "import"
					? foods.find(id)
					: undefined
			: undefined;
	return (
		<>
			<Stack.Screen
				options={{
					title: t.diaryEntry.details,
					headerLeft: () => (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t.common.back}
							onPress={() => router.back()}
							style={{ minWidth: 48, minHeight: 48, justifyContent: "center" }}
						>
							<AppText>‹</AppText>
						</Pressable>
					),
				}}
			/>
			<FoodViewScreen food={food} />
		</>
	);
}
