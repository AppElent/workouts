import type { NutrientKey } from "@workouts/core/nutrition";
import { View } from "react-native";
import { useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";
import {
	FOOD_NUTRIENT_ROWS,
	type NutrientInput,
	type useNutrientFields,
} from "../use-nutrient-fields";
import { FoodValueField } from "./food-value-field";

/**
 * All eight nutrients of a food form, each value its own field with the unit
 * after it. Sits inside a FoodFormCard; rows after it may follow.
 */
export function FoodNutrientRows({
	values,
	fields,
}: {
	values: Readonly<Record<NutrientKey, NutrientInput>>;
	fields: ReturnType<typeof useNutrientFields>;
}) {
	const { t } = useI18n();
	const copy = t.nutrition.foodEditor;
	const colors = useTokens();
	return FOOD_NUTRIENT_ROWS.map(({ key, indent }, index) => {
		const input = values[key];
		return (
			<View
				key={key}
				style={{
					minHeight: 48,
					flexDirection: "row",
					alignItems: "center",
					paddingLeft: indent ? spacing.md + 16 : spacing.md,
					paddingRight: spacing.md,
					borderTopWidth: index ? 0.5 : 0,
					borderTopColor: colors.separator,
				}}
			>
				<AppText
					variant="secondary"
					style={{ flex: 1, color: indent ? colors.textMuted : colors.text }}
				>
					{indent
						? key === "sugars"
							? copy.ofWhichSugars
							: copy.ofWhichSaturated
						: t.nutrition.nutrients[key]}
				</AppText>
				<FoodValueField
					{...fields.field(key)}
					display={
						input.kind === "trace"
							? copy.trace
							: input.kind === "value"
								? input.amount
								: "—"
					}
					unit={input.kind === "value" ? (key === "energy" ? "kcal" : "g") : ""}
					accessibilityLabel={t.nutrition.nutrients[key]}
					emphasis={input.kind === "value"}
				/>
			</View>
		);
	});
}
