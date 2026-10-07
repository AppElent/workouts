import {
	NUTRIENT_DISPLAY_DECIMALS,
	NUTRIENT_KEYS,
	NUTRIENT_UNITS,
	type NutrientKey,
	type NutrientValue,
	scaleNutrient,
} from "@workouts/core/nutrition";
import { useWindowDimensions, View } from "react-native";
import { useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";
/** Used by the entry snapshot comparison and read-only food details. */
export function NutrientTable({
	nutrients,
	factor = 1,
	referenceFactor,
	referenceLabel,
	all = false,
	valueLabel,
	compact = false,
}: {
	nutrients: Partial<Record<NutrientKey, NutrientValue>>;
	factor?: number;
	referenceFactor?: number;
	referenceLabel?: string;
	all?: boolean;
	valueLabel?: string;
	compact?: boolean;
}) {
	const { t, locale } = useI18n();
	const colors = useTokens();
	const { fontScale } = useWindowDimensions();
	const valueColumn =
		compact && fontScale < 1.5 ? { width: 76 * fontScale } : { flex: 1 };
	const referenceColumn =
		compact && fontScale < 1.5 ? { width: 70 * fontScale } : { flex: 1 };
	const keys = all
		? NUTRIENT_KEYS
		: (["energy", "protein", "carbs", "fat"] as const);
	function value(key: NutrientKey, multiplier: number) {
		const n = scaleNutrient(nutrients[key] ?? { kind: "absent" }, multiplier);
		if (n.kind === "absent") return "—";
		if (n.kind === "trace") return t.nutrition.foodBrowser.trace;
		return `${n.amount.toLocaleString(locale, { maximumFractionDigits: NUTRIENT_DISPLAY_DECIMALS[key] })} ${NUTRIENT_UNITS[key]}`;
	}
	return (
		<View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
			<View
				style={{
					flexDirection: "row",
					paddingTop: spacing.sm,
					paddingBottom: compact ? 0 : spacing.sm,
				}}
			>
				<View style={{ flex: compact ? 1 : 1.3 }} />
				<AppText
					variant="caption"
					style={{ ...valueColumn, textAlign: "right" }}
				>
					{valueLabel ?? t.diaryEntry.thisItem}
				</AppText>
				{referenceLabel && (
					<AppText
						variant="caption"
						style={{ ...referenceColumn, textAlign: "right" }}
					>
						{referenceLabel}
					</AppText>
				)}
			</View>
			{keys.map((key, index) => (
				<View
					key={key}
					style={{
						flexDirection: "row",
						alignItems: "center",
						minHeight: compact ? undefined : 40,
						paddingVertical: compact ? spacing.sm : spacing.xs,
						borderTopWidth: compact && index === 0 ? 0 : 0.5,
						borderColor: colors.separator,
					}}
				>
					<AppText
						variant={compact ? "table" : "body"}
						style={{ flex: compact ? 1 : 1.3 }}
					>
						{t.nutrition.nutrients[key]}
					</AppText>
					<AppText
						variant={compact ? "table" : "body"}
						style={{
							...valueColumn,
							textAlign: "right",
							fontVariant: ["tabular-nums"],
							fontWeight: key === "energy" ? "700" : "500",
						}}
					>
						{value(key, factor)}
					</AppText>
					{referenceFactor !== undefined && (
						<AppText
							variant={compact ? "table" : "body"}
							style={{
								...referenceColumn,
								textAlign: "right",
								color: colors.textMuted,
								fontVariant: ["tabular-nums"],
							}}
						>
							{value(key, referenceFactor)}
						</AppText>
					)}
				</View>
			))}
		</View>
	);
}
