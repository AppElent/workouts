import type { PersonalFood, ShippedFood } from "@workouts/core/nutrition";
import { ScrollView, View } from "react-native";
import { useSupplementaryServings } from "../../../data/supplementary-servings";
import { useI18n } from "../../../i18n";
import { radius, spacing, useTokens } from "../../../theme";
import { FoodVisualView } from "../../../ui/food-visual";
import { AppText } from "../../../ui/text";
import { NutrientTable } from "../components/nutrient-table";
export function FoodViewScreen({
	food,
}: {
	food?: ShippedFood | PersonalFood;
}) {
	const { t, locale } = useI18n();
	const colors = useTokens();
	const additions = useSupplementaryServings(
		food && "source" in food ? food.id : undefined,
	);
	if (!food) return <AppText>{t.diaryEntry.unavailable}</AppText>;
	const isShipped = "source" in food;
	const basisLabel =
		!isShipped && food.nutritionBasis?.kind === "perServing"
			? food.nutritionBasis.label[locale]
			: `${t.nutrition.foodBrowser.per100} ${food.baseUnit}`;
	return (
		<ScrollView
			contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
		>
			<FoodVisualView
				label={food.name[locale]}
				visual={!isShipped ? food.visual : undefined}
			/>
			<AppText variant="title">{food.name[locale]}</AppText>
			<AppText variant="heading">{basisLabel}</AppText>
			<View
				style={{ backgroundColor: colors.surface, borderRadius: radius.sheet }}
			>
				<NutrientTable nutrients={food.nutrients} valueLabel={basisLabel} all />
			</View>
			<AppText variant="heading">{t.diaryEntry.foodServings}</AppText>
			{[
				...food.servings,
				...additions.servings.map((item) => ({
					label: { en: item.name, nl: item.name },
					amount: item.amount,
				})),
			].map((serving) => (
				<AppText key={`${serving.label.en}:${serving.amount}`}>
					{serving.label[locale]} · {serving.amount.toLocaleString(locale)}{" "}
					{food.baseUnit}
				</AppText>
			))}
		</ScrollView>
	);
}
