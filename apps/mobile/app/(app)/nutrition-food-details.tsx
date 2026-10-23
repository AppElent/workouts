import { getShippedFood } from "@foundry/core/nutrition";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable } from "react-native";
import { usePersonalFoods } from "../../src/data/personal-foods";
import { FoodViewScreen } from "../../src/features/nutrition/food/food-view-screen";
import { PersonalFoodEditor } from "../../src/features/nutrition/personal-food/personal-food-editor";
import { useI18n } from "../../src/i18n";
import { useTokens } from "../../src/theme";
export default function NutritionFoodDetailsRoute() {
	const { id, source } = useLocalSearchParams<{
		id?: string;
		source?: string;
	}>();
	const foods = usePersonalFoods({
		ids: id && source !== "shipped" ? [id] : [],
	});
	const { t } = useI18n();
	const colors = useTokens();
	const food =
		typeof id === "string"
			? source === "shipped"
				? getShippedFood(id)
				: source === "personal" || source === "import"
					? foods.find(id)
					: undefined
			: undefined;
	// A Personal Food opens as it does from the Library: one view of it everywhere.
	if (food && !("source" in food))
		return (
			<PersonalFoodEditor
				food={food}
				chrome="route"
				onCancel={() => router.back()}
				onSaved={() => router.back()}
			/>
		);
	return (
		<>
			<Stack.Screen
				options={{
					title: t.diaryEntry.details,
					headerShown: true,
					headerLeft: () => (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t.nutrition.entryActions.close}
							onPress={() => router.back()}
							style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
						>
							<SymbolView
								name={{ ios: "xmark", android: "close", web: "close" }}
								size={18}
								weight="semibold"
								tintColor={colors.text}
							/>
						</Pressable>
					),
				}}
			/>
			<FoodViewScreen food={food} />
		</>
	);
}
