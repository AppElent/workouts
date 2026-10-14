import { SymbolView } from "expo-symbols";
import { View } from "react-native";
import { useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { PrimaryButton } from "../../../ui/button";
import { TextAction } from "../../../ui/form";
import { AppText } from "../../../ui/text";
import { FoodFormCard } from "./food-form-section";

/** Shown once before the first AI request on this phone. */
export function NutritionAiConsent({
	onContinue,
	onDecline,
}: {
	onContinue: () => void;
	onDecline: () => void;
}) {
	const { t } = useI18n();
	const copy = t.nutrition.assistance;
	const colors = useTokens();
	const points = [
		["paperplane", copy.consentSend],
		["trash", copy.consentStore],
		["checkmark.circle", copy.consentReview],
	] as const;
	return (
		<View style={{ gap: spacing.md, paddingTop: spacing.lg }}>
			<View style={{ alignItems: "center", gap: spacing.sm }}>
				<SymbolView
					name={{
						ios: "sparkles",
						android: "auto_awesome",
						web: "auto_awesome",
					}}
					size={36}
					tintColor={colors.accent}
				/>
				<AppText variant="title" accessibilityRole="header">
					{copy.consentTitle}
				</AppText>
			</View>
			<FoodFormCard>
				{points.map(([symbol, text], index) => (
					<View
						key={symbol}
						style={{
							flexDirection: "row",
							gap: spacing.md,
							padding: spacing.md,
							borderTopWidth: index ? 0.5 : 0,
							borderTopColor: colors.separator,
						}}
					>
						<SymbolView
							name={{ ios: symbol, android: "info", web: "info" }}
							size={20}
							tintColor={colors.textMuted}
						/>
						<AppText
							variant="secondary"
							style={{ flex: 1, color: colors.text }}
						>
							{text}
						</AppText>
					</View>
				))}
			</FoodFormCard>
			<PrimaryButton label={copy.consentContinue} onPress={onContinue} />
			<TextAction label={copy.consentNotNow} onPress={onDecline} />
		</View>
	);
}
