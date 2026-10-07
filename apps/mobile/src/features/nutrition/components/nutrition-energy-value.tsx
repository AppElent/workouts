import { View } from "react-native";
import { useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";

/** A row's trailing figure: "389 kcal" over what it is for, "per 100 g". */
export function NutritionEnergyValue({
	value,
	basis,
}: {
	value?: string;
	basis?: string;
}) {
	const colors = useTokens();
	return (
		<View style={{ alignItems: "flex-end" }}>
			{value ? (
				<AppText variant="label" style={{ color: colors.text }}>
					{value}
				</AppText>
			) : null}
			{basis ? (
				<AppText variant="caption" numberOfLines={1}>
					{basis}
				</AppText>
			) : null}
		</View>
	);
}
