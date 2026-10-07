import { SymbolView } from "expo-symbols";
import { View } from "react-native";
import { radius, spacing, useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";

/** Replacing: the part that goes, above the results that can take its place. */
export function LogFoodReplacedPart({
	name,
	detail,
	missing,
}: {
	name: string;
	/** Such as "Was: 1 piece · 62 g · 130 kcal". */
	detail: string;
	/** Its source is gone; the warning sign says why it is being replaced. */
	missing: boolean;
}) {
	const colors = useTokens();
	return (
		<View
			accessible
			accessibilityLabel={`${name}, ${detail}`}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 12,
				padding: spacing.md,
				marginHorizontal: spacing.md,
				borderRadius: radius.contentCard,
				backgroundColor: colors.surface,
			}}
		>
			{missing ? (
				<SymbolView
					name={{
						ios: "exclamationmark.triangle",
						android: "warning",
						web: "warning",
					}}
					size={18}
					tintColor={colors.warn}
				/>
			) : null}
			<View style={{ flex: 1 }}>
				<AppText variant="control">{name}</AppText>
				<AppText variant="caption">{detail}</AppText>
			</View>
		</View>
	);
}
