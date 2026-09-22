import type { PersonalFood } from "@workouts/core/nutrition";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { todayIsoDate } from "../data/calendar-day";
import type { Combo } from "../data/personal-food-repository";
import { usePersonalFoods } from "../data/personal-foods";
import { useI18n } from "../i18n";
import { spacing, type Tokens, useThemedStyles } from "../theme";
import { PrimaryButton } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { AppText } from "../ui/text";
import { PersonalFoodEditor } from "./personal-food-editor";

type LibraryTab = "foods" | "combos" | "recipes";
export function FoodLibraryScreen() {
	const styles = useThemedStyles(createStyles);
	const { locale } = useI18n();
	const router = useRouter();
	const library = usePersonalFoods();
	const [tab, setTab] = useState<LibraryTab>("foods");
	const [editing, setEditing] = useState<PersonalFood | "new" | null>(null);
	const copy =
		locale === "nl"
			? {
					foods: "Persoonlijke voeding",
					combos: "Combo's",
					recipes: "Recepten",
					addFood: "Voeding toevoegen",
					addRecipe: "Recept toevoegen",
					emptyFoods: "Nog geen persoonlijke voeding",
					emptyCombos: "Nog geen combo's",
					emptyRecipes: "Nog geen recepten",
					parts: "voedingsmiddelen",
				}
			: {
					foods: "Personal foods",
					combos: "Combos",
					recipes: "Recipes",
					addFood: "Add food",
					addRecipe: "Add recipe",
					emptyFoods: "No personal foods yet",
					emptyCombos: "No combos yet",
					emptyRecipes: "No recipes yet",
					parts: "foods",
				};
	const items =
		tab === "foods"
			? library.list({ classification: "ordinary" })
			: tab === "recipes"
				? library.list({ classification: "recipe" })
				: library.listCombos();
	if (editing)
		return (
			<PersonalFoodEditor
				food={editing === "new" ? undefined : editing}
				defaultClassification={tab === "recipes" ? "recipe" : "ordinary"}
				onCancel={() => setEditing(null)}
				onSaved={() => setEditing(null)}
			/>
		);
	return (
		<View style={styles.root}>
			<View accessibilityRole="tablist" style={styles.tabs}>
				{(["foods", "combos", "recipes"] as const).map((value) => (
					<Pressable
						key={value}
						onPress={() => setTab(value)}
						accessibilityRole="tab"
						accessibilityState={{ selected: tab === value }}
						style={[styles.tab, tab === value && styles.selectedTab]}
					>
						<AppText style={tab === value ? styles.selectedText : undefined}>
							{copy[value]}
						</AppText>
					</Pressable>
				))}
			</View>
			<ScrollView contentContainerStyle={styles.content}>
				{items.length === 0 ? (
					<EmptyState
						body={
							tab === "foods"
								? copy.emptyFoods
								: tab === "recipes"
									? copy.emptyRecipes
									: copy.emptyCombos
						}
					/>
				) : (
					items.map((item) =>
						tab === "combos" ? (
							<Pressable
								key={item.id}
								accessibilityRole="button"
								style={styles.row}
								onPress={() =>
									router.push({
										pathname: "/nutrition-combos",
										params: {
											date: todayIsoDate(),
											meal: "breakfast",
											comboId: item.id,
										},
									})
								}
							>
								<View style={styles.flex}>
									<AppText variant="heading">{(item as Combo).name}</AppText>
									<AppText variant="caption">
										{(item as Combo).parts.length} {copy.parts}
									</AppText>
								</View>
								<AppText style={styles.chevron}>›</AppText>
							</Pressable>
						) : (
							<Pressable
								key={item.id}
								accessibilityRole="button"
								style={styles.row}
								onPress={() => setEditing(item as PersonalFood)}
							>
								<AppText variant="heading" style={styles.flex}>
									{(item as PersonalFood).name[locale]}
								</AppText>
								<AppText style={styles.chevron}>›</AppText>
							</Pressable>
						),
					)
				)}
			</ScrollView>
			{tab !== "combos" ? (
				<View style={styles.footer}>
					<PrimaryButton
						label={tab === "recipes" ? copy.addRecipe : copy.addFood}
						onPress={() => setEditing("new")}
					/>
				</View>
			) : null}
		</View>
	);
}
const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		tabs: {
			flexDirection: "row",
			margin: spacing.md,
			padding: 2,
			borderRadius: 12,
			backgroundColor: colors.surface2,
		},
		tab: {
			flex: 1,
			minHeight: 44,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: 10,
			paddingHorizontal: spacing.xs,
		},
		selectedTab: { backgroundColor: colors.surface },
		selectedText: { color: colors.accent, fontWeight: "800" },
		content: {
			paddingHorizontal: spacing.md,
			paddingBottom: spacing.xl,
			gap: 1,
		},
		row: {
			minHeight: 56,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			padding: spacing.md,
			backgroundColor: colors.surface,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		flex: { flex: 1 },
		chevron: { color: colors.textMuted, fontSize: 24 },
		footer: {
			padding: spacing.md,
			paddingBottom: spacing.lg,
			borderTopWidth: 1,
			borderTopColor: colors.border,
			backgroundColor: colors.bg,
		},
	});
