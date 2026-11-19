/**
 * The Krachtprofiel of one exercise outside a session (APP-393): the same
 * references and tables, read-only. It reads the account's current references,
 * not a session snapshot, so there is nothing to apply.
 */
import { resolveStrengthReferences } from "@foundry/core";
import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { api } from "../../convex/api";
import { useQuery } from "../../convex/query-cache";
import { useExercise } from "../../data/exercises";
import { useI18n } from "../../i18n";
import { spacing, type Tokens, useThemedStyles, useTokens } from "../../theme";
import { SkeletonList } from "../../ui/skeleton";
import { AppText } from "../../ui/text";
import { StrengthProfileView } from "./components/strength-profile-view";
import { factsFrom } from "./data/session-workspace";
import { referenceFromFacts } from "./session-plan";

export function ExerciseStrengthProfileScreen() {
	const { exerciseId } = useLocalSearchParams<{ exerciseId?: string }>();
	const { t } = useI18n();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const exercise = useExercise(exerciseId);
	const records = useQuery(
		api.oneRepMaxes.listForExercise,
		exerciseId ? { exerciseId } : "skip",
	);
	const copy = t.strength.plan.profile;
	const title = exercise ? `${copy.title} · ${exercise.name}` : copy.title;
	const options = { title, headerTitleStyle: { color: colors.text } };
	if (exercise === null)
		return (
			<View style={[styles.screen, styles.centered]}>
				<Stack.Screen options={options} />
				<AppText variant="heading">{t.exercises.detail.notFound}</AppText>
			</View>
		);
	if (exercise === undefined || records === undefined)
		return (
			<View style={[styles.screen, styles.centered]}>
				<Stack.Screen options={options} />
				<SkeletonList rows={3} />
			</View>
		);
	const facts = factsFrom(
		exercise,
		resolveStrengthReferences(records, exercise),
		null,
		exerciseId,
	);
	return (
		<>
			<Stack.Screen options={options} />
			<StrengthProfileView
				facts={facts}
				reference={referenceFromFacts(facts, undefined)}
				manual={facts.savedManual}
			/>
		</>
	);
}
const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		screen: { flex: 1, backgroundColor: colors.bg },
		centered: {
			alignItems: "center",
			justifyContent: "center",
			gap: spacing.sm,
			padding: spacing.md,
		},
	});
