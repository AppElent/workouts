import { formatClock } from "@foundry/core";
/** The end of a session, before it is saved. Back to session reopens it. */
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmt, plural, useI18n } from "../../../i18n";
import {
	opacity,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { AppText } from "../../../ui/text";
import { formatNumber, formatScore, formatSetShort } from "../session-format";
import type { PlanFacts, RecapRow, recapOf } from "../session-plan";

function tagText(
	row: RecapRow,
	copy: ReturnType<typeof useI18n>["t"]["strength"]["plan"]["finish"],
	locale: string,
) {
	const value =
		row.was === null ? "" : formatNumber(Math.round(row.was), locale);
	switch (row.tag) {
		case "newMeasured":
			return copy.tagNewMeasured;
		case "newEstimated":
			return copy.tagNewEstimated;
		case "same":
			return fmt(copy.tagSame, { value });
		case "yourBest":
			return fmt(copy.tagBest, { value });
		default:
			return null;
	}
}
export function SessionRecap({
	name,
	elapsedSeconds,
	recap,
	getFacts,
	nameOf,
	busy,
	onConfirm,
	onBack,
}: {
	name: string;
	elapsedSeconds: number;
	recap: ReturnType<typeof recapOf>;
	getFacts: PlanFacts;
	nameOf: (exerciseId: string) => string;
	busy: boolean;
	onConfirm: () => void;
	onBack: () => void;
}) {
	const { locale, t } = useI18n();
	const copy = t.strength.plan.finish;
	const groupCopy = t.strength.plan.group;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const hero = recap.heroes[0];
	const scoreText = (rounds: number, sets: number) =>
		formatScore(groupCopy, locale, { rounds, sets });
	return (
		<View style={styles.screen}>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={styles.content}
			>
				<AppText
					variant="largeTitle"
					maxFontSizeMultiplier={1.5}
					accessibilityRole="header"
				>
					{fmt(copy.recapTitle, { name })}
				</AppText>
				<AppText variant="secondary" style={{ color: colors.textMuted }}>
					{fmt(copy.recapLine, {
						time: formatClock(elapsedSeconds),
						sets: plural(locale, recap.sets, copy.rowSets),
					})}
					{recap.volume > 0
						? fmt(copy.recapVolume, {
								volume: formatNumber(Math.round(recap.volume), locale),
							})
						: ""}
				</AppText>
				{hero?.best ? (
					<View style={styles.hero}>
						<AppText variant="label" style={styles.heroInk}>
							{fmt(
								hero.tag === "newMeasured"
									? copy.heroMeasured
									: copy.heroEstimated,
								{ name: nameOf(hero.exerciseId) },
							)}
						</AppText>
						<AppText variant="quantityCompact" style={styles.heroInk}>
							{hero.tag === "newMeasured" ? "" : "≈"}
							{formatNumber(
								hero.tag === "newMeasured"
									? Math.round(hero.best.value * 10) / 10
									: Math.round(hero.best.value),
								locale,
							)}{" "}
							kg
						</AppText>
						<AppText variant="secondary" style={styles.heroInk}>
							{[
								hero.was === null
									? null
									: fmt(copy.heroWas, {
											value: formatNumber(Math.round(hero.was), locale),
										}),
								hero.tag === "newMeasured"
									? copy.heroApplies
									: copy.heroEstimate,
							]
								.filter(Boolean)
								.join(" · ")}
						</AppText>
						{recap.heroes.length > 1 ? (
							<AppText variant="caption" style={styles.heroInk}>
								{fmt(copy.heroMore, { count: recap.heroes.length - 1 })}
							</AppText>
						) : null}
					</View>
				) : null}
				<View style={styles.card}>
					{recap.exercises.map((row, index) => {
						const facts = getFacts(row.exerciseId);
						const tag = tagText(row, copy, locale);
						return (
							<View
								key={row.exerciseId}
								accessible
								style={[styles.row, index > 0 && styles.rowLine]}
							>
								<View style={styles.rowText}>
									<AppText variant="row" style={{ fontWeight: "600" }}>
										{nameOf(row.exerciseId)}
									</AppText>
									<AppText
										variant="secondary"
										style={{ color: colors.textMuted }}
									>
										{plural(locale, row.sets, copy.rowSets)}
										{row.topLoad
											? ` · ${formatSetShort(row.topLoad, facts.bodyweight, locale)}`
											: ""}
									</AppText>
								</View>
								<View style={styles.rowEnd}>
									{row.best ? (
										<AppText variant="row" style={{ fontWeight: "600" }}>
											{row.best.measured ? "" : "≈"}
											{formatNumber(
												// An estimate reads the same as it did in the table.
												row.best.measured
													? Math.round(row.best.value * 10) / 10
													: Math.round(row.best.value),
												locale,
											)}{" "}
											kg
										</AppText>
									) : null}
									{tag ? (
										<AppText
											variant="caption"
											style={{
												color:
													row.tag === "newMeasured" ||
													row.tag === "newEstimated"
														? colors.accent
														: colors.textMuted,
											}}
										>
											{tag}
										</AppText>
									) : null}
								</View>
							</View>
						);
					})}
					{recap.groups.map((group) => (
						<View
							key={group.id}
							accessible
							style={[styles.row, styles.rowLine]}
						>
							<View style={styles.rowText}>
								<AppText variant="row" style={{ fontWeight: "600" }}>
									{copy.groupAmrap}
								</AppText>
								<AppText
									variant="secondary"
									style={{ color: colors.textMuted }}
								>
									{group.exercises.map(nameOf).join(" · ")}
								</AppText>
							</View>
							<AppText variant="row" style={{ fontWeight: "600" }}>
								{scoreText(group.rounds, group.sets)}
							</AppText>
						</View>
					))}
				</View>
			</ScrollView>
			<View
				style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}
			>
				<Pressable
					accessibilityRole="button"
					disabled={busy}
					onPress={onConfirm}
					style={[styles.primary, busy && { opacity: opacity.disabled }]}
					testID="session-recap-confirm"
				>
					<AppText
						variant="control"
						style={{ color: colors.onAccent, fontWeight: "700" }}
					>
						{copy.confirm}
					</AppText>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					disabled={busy}
					onPress={onBack}
					style={styles.secondary}
				>
					<AppText variant="control" style={{ color: colors.text }}>
						{copy.back}
					</AppText>
				</Pressable>
			</View>
		</View>
	);
}
const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		screen: { flex: 1, backgroundColor: colors.bg },
		content: { padding: spacing.md, gap: spacing.sm },
		hero: {
			marginTop: spacing.sm,
			padding: spacing.md,
			gap: 2,
			backgroundColor: colors.accentFill,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
		},
		heroInk: { color: colors.onAccent },
		card: {
			marginTop: spacing.sm,
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			flexWrap: "wrap",
			minHeight: 60,
			padding: spacing.md,
		},
		rowLine: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		rowText: { flex: 1, minWidth: 160, gap: 2 },
		rowEnd: { alignItems: "flex-end", gap: 2 },
		footer: {
			paddingHorizontal: spacing.md,
			paddingTop: spacing.sm,
			gap: spacing.xs,
		},
		primary: {
			minHeight: 56,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.pill,
			backgroundColor: colors.accentFill,
		},
		secondary: {
			minHeight: 48,
			alignItems: "center",
			justifyContent: "center",
		},
	});
