/**
 * The language switch, pushed from Profile → Preferences. A signed-out person
 * has stated no preference, so the device decides for them. The choice belongs
 * to this device, not to the account.
 */
import { ScrollView, StyleSheet } from "react-native";
import { type Locale, SUPPORTED_LOCALES, useI18n } from "../../i18n";
import { spacing } from "../../theme";
import { Screen } from "../../ui/screen";
import { ScreenHeader } from "../../ui/screen-header";
import { Segmented } from "../../ui/segmented";
import { AppText } from "../../ui/text";

export function LanguageScreen() {
	const { t, locale, setLocale } = useI18n();

	return (
		<Screen>
			<ScreenHeader title={t.language.title} />

			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={styles.body}
			>
				<Segmented<Locale>
					value={locale}
					onChange={setLocale}
					options={SUPPORTED_LOCALES.map((option) => ({
						value: option,
						label: t.language.names[option],
					}))}
				/>
				<AppText variant="caption">{t.language.description}</AppText>
			</ScrollView>
		</Screen>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingHorizontal: 20,
		paddingVertical: spacing.md,
	},
	flex: { flex: 1 },
	body: { paddingHorizontal: 20, gap: spacing.md },
});
