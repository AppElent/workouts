/**
 * The language switch, pushed from Profile → Preferences.
 *
 * Behind the door on purpose. A signed-out person has stated no preference, so
 * the device decides for them; a signed-in person changes it here, once, and
 * the choice survives reinstallation of the session but not of the app.
 *
 * Changing the locale re-renders the whole tree from the provider in
 * `app/_layout.tsx`, so this screen's own words change under the finger that
 * changed them — which is the point, and the fastest way to see the switch
 * worked.
 */
import { ScrollView, StyleSheet } from "react-native";
import { type Locale, SUPPORTED_LOCALES, useI18n } from "../i18n";
import { spacing } from "../theme";
import { Screen } from "../ui/screen";
import { ScreenHeader } from "../ui/screen-header";
import { Segmented } from "../ui/segmented";
import { AppText } from "../ui/text";

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
