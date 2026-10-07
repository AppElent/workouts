import type { NutrientTotal } from "@workouts/core/nutrition";
import { Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { NutrientGoal, NutrientKey } from "../../../../data/nutrition-day";
import { useI18n } from "../../../../i18n";
import { radius, spacing, useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";
import {
	displayAmount,
	groupGoals,
	outcome,
} from "../../day-goals/goal-presentation";

export function DiarySummary({
	goals,
	totals,
	onOpen,
	onSetup,
}: {
	goals: NutrientGoal[];
	totals: Partial<Record<NutrientKey, NutrientTotal>>;
	onOpen: () => void;
	onSetup: () => void;
}) {
	const { t, locale } = useI18n();
	const colors = useTokens();
	const amount = (n: NutrientKey, value?: NutrientTotal) =>
		displayAmount(n, value).replace(/\d+(?:\.\d+)?/, (number) =>
			new Intl.NumberFormat(locale).format(Number(number)),
		);
	const groups = groupGoals(goals, [
		"energy",
		"protein",
		"carbs",
		"fat",
		"saturatedFat",
		"fibre",
		"sugars",
		"salt",
	]);
	const energy = groups.find((g) => g.nutrient === "energy");
	const total = totals.energy;
	const denominator = energy?.max ?? energy?.min;
	const fraction = denominator
		? Math.min(1, (total?.amount ?? 0) / denominator)
		: 0;
	const exceeded = groups.filter(
		(g) => g.max !== undefined && (totals[g.nutrient]?.amount ?? 0) > g.max,
	).length;
	const incomplete = groups.some((g) => totals[g.nutrient]?.incomplete);
	const energyStatus = energy ? outcome(colors, t, energy, total) : undefined;
	if (!goals.length)
		return (
			<View
				style={{
					backgroundColor: colors.surface,
					borderRadius: radius.contentCard,
					overflow: "hidden",
				}}
			>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={
						locale === "nl" ? "Alle voedingsstoffen" : "All nutrients"
					}
					onPress={onOpen}
					style={{
						backgroundColor: colors.surface,
						borderRadius: radius.contentCard,
						padding: spacing.md,
						gap: 4,
					}}
				>
					<AppText variant="metric">
						{amount("energy", total)}{" "}
						<AppText variant="secondary">
							kcal {locale === "nl" ? "vandaag" : "today"}
						</AppText>
					</AppText>
					<AppText variant="footnote">
						{(["protein", "carbs", "fat"] as const)
							.map(
								(n) => `${t.nutrition.nutrients[n]} ${amount(n, totals[n])} g`,
							)
							.join(" · ")}
					</AppText>
					<AppText variant="caption" style={{ color: colors.accent }}>
						{locale === "nl" ? "Alle voedingsstoffen" : "All nutrients"} ›
					</AppText>
				</Pressable>
				<View
					style={{
						backgroundColor: colors.surface,
						borderRadius: radius.contentCard,
						padding: spacing.md,
						borderTopWidth: 0.5,
						borderTopColor: colors.separator,
						flexDirection: "row",
						alignItems: "center",
						gap: 12,
					}}
				>
					<View style={{ flex: 1, gap: 4 }}>
						<AppText>{t.nutrition.goals.empty.title}</AppText>
						<AppText variant="caption">
							{locale === "nl"
								? "Begin met je profiel of kies een preset"
								: "Start with your profile or choose a preset"}
						</AppText>
					</View>
					<Pressable
						accessibilityRole="button"
						onPress={onSetup}
						style={{
							minHeight: 44,
							justifyContent: "center",
							backgroundColor: colors.accentFill,
							borderRadius: radius.pill,
							paddingHorizontal: 12,
						}}
					>
						<AppText variant="label" style={{ color: colors.onAccent }}>
							{t.nutrition.goals.empty.action}
						</AppText>
					</Pressable>
				</View>
			</View>
		);
	return (
		<View
			style={{
				backgroundColor: colors.surface,
				borderRadius: radius.contentCard,
				overflow: "hidden",
			}}
		>
			<View
				style={{
					padding: spacing.md,
					flexDirection: "row",
					alignItems: "center",
					gap: spacing.md,
					flexWrap: "wrap",
				}}
			>
				<View
					accessible
					accessibilityLabel={`${t.nutrition.nutrients.energy}: ${amount("energy", total)} kcal`}
					style={{
						width: 96,
						height: 96,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Svg width={96} height={96} style={{ position: "absolute" }}>
						<Circle
							cx={48}
							cy={48}
							r={42.5}
							fill="none"
							stroke={colors.surface2}
							strokeWidth={9}
						/>
						<Circle
							cx={48}
							cy={48}
							r={42.5}
							fill="none"
							stroke={
								total?.incomplete
									? colors.textMuted
									: (energyStatus?.color ?? colors.accent)
							}
							strokeWidth={9}
							strokeLinecap="round"
							strokeDasharray={`${fraction * 267.04} 267.04`}
							rotation={-90}
							origin="48,48"
						/>
					</Svg>
					<AppText
						variant="title"
						style={{ maxWidth: 72 }}
						adjustsFontSizeToFit
						numberOfLines={1}
					>
						{amount("energy", total)}
					</AppText>
					<AppText variant="caption">
						{denominator
							? `${locale === "nl" ? "van" : "of"} ${new Intl.NumberFormat(locale).format(denominator)}`
							: "kcal"}
					</AppText>
				</View>
				<View style={{ flex: 1, minWidth: 170, gap: spacing.sm }}>
					<AppText variant="body" style={{ fontWeight: "700" }}>
						{energyStatus?.label ??
							(locale === "nl" ? "Je voeding vandaag" : "Your daily nutrition")}
					</AppText>
					<View style={{ flexDirection: "row", gap: spacing.sm }}>
						{(["protein", "carbs", "fat"] as const).map((n) => {
							const group = groups.find((g) => g.nutrient === n);
							const target = group?.max ?? group?.min;
							const v = totals[n];
							const over =
								group?.max !== undefined && (v?.amount ?? 0) > group.max;
							return (
								<View key={n} style={{ flex: 1, gap: spacing.xs }}>
									<AppText
										variant="caption"
										accessibilityLabel={t.nutrition.nutrients[n]}
									>
										{n === "carbs"
											? locale === "nl"
												? "Koolh."
												: "Carbs"
											: t.nutrition.nutrients[n]}
									</AppText>
									<AppText
										variant="body"
										style={{ color: over ? colors.danger : colors.text }}
									>
										{amount(n, v)}
										<AppText variant="caption">
											{target
												? `\n/ ${new Intl.NumberFormat(locale).format(target)}`
												: " g"}
										</AppText>
									</AppText>
									<View
										style={{
											height: 5,
											borderRadius: 3,
											backgroundColor: colors.surface2,
											overflow: "hidden",
										}}
									>
										<View
											style={{
												height: 5,
												width: `${target ? Math.min(100, ((v?.amount ?? 0) / target) * 100) : 0}%`,
												backgroundColor: v?.incomplete
													? colors.textMuted
													: over
														? colors.danger
														: colors.accent,
											}}
										/>
									</View>
								</View>
							);
						})}
					</View>
				</View>
			</View>
			<Pressable
				accessibilityRole="button"
				onPress={onOpen}
				style={{
					minHeight: 48,
					borderTopWidth: 0.5,
					borderTopColor: colors.separator,
					paddingHorizontal: spacing.md,
					flexDirection: "row",
					alignItems: "center",
					gap: spacing.sm,
				}}
			>
				<AppText style={{ flex: 1 }}>
					{locale === "nl" ? "Alle doelen" : "All goals"}
				</AppText>
				{exceeded ? (
					<AppText
						variant="caption"
						style={{
							color: colors.danger,
							backgroundColor: colors.dangerSoft,
							paddingHorizontal: 8,
							paddingVertical: 3,
							borderRadius: 10,
						}}
					>{`${exceeded} ${locale === "nl" ? "te veel" : "over target"}`}</AppText>
				) : incomplete ? (
					<AppText variant="caption">{t.nutrition.goals.incomplete}</AppText>
				) : null}
				<AppText>›</AppText>
			</Pressable>
		</View>
	);
}
