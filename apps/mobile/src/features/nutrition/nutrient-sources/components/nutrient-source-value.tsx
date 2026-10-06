import { View } from "react-native";
import { useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";

export function NutrientSourceValue({
	label,
	share,
	relativeShare,
}: {
	label: string;
	share: number;
	relativeShare: number;
}) {
	const colors = useTokens();
	return (
		<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
			<View style={{ alignItems: "flex-end", gap: 2 }}>
				<AppText style={{ fontWeight: "600", fontVariant: ["tabular-nums"] }}>
					{label}
				</AppText>
				<AppText variant="caption">{Math.round(share * 100)}%</AppText>
			</View>
			<View
				style={{
					width: 32,
					height: 5,
					borderRadius: 3,
					backgroundColor: colors.surface2,
					overflow: "hidden",
				}}
			>
				<View
					style={{
						height: 5,
						width: `${Math.max(0, Math.min(100, relativeShare * 100))}%`,
						backgroundColor: colors.accent,
					}}
				/>
			</View>
		</View>
	);
}
