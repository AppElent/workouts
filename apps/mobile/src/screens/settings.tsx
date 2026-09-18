import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { useI18n } from "../i18n";
import { colors, spacing } from "../theme";
import { AppText } from "../ui/text";

export function SettingsScreen() {
	const router = useRouter();
	const { locale } = useI18n();
	return (
		<ScrollView style={styles.root} contentContainerStyle={styles.content}>
			<Pressable
				onPress={() => router.push("/nutrition-settings")}
				accessibilityRole="button"
				style={styles.row}
			>
				<AppText variant="heading">
					{locale === "nl" ? "Voeding" : "Nutrition"}
				</AppText>
				<AppText style={styles.chevron}>›</AppText>
			</Pressable>
		</ScrollView>
	);
}
const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: spacing.md },
	row: {
		minHeight: 52,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: spacing.md,
		backgroundColor: colors.surface,
		borderRadius: 14,
	},
	chevron: { color: colors.accent, fontSize: 24 },
});
