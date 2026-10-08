import { useUser } from "@clerk/expo";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../i18n";
import { spacing } from "../../theme";
import { DisclosureRow, FormScreen, FormSection } from "../../ui/form";
import { AppText } from "../../ui/text";

export function AccountScreen() {
	const { user } = useUser();
	const { t } = useI18n();
	return (
		<FormScreen>
			<FormSection
				title={t.profile.account}
				footer={t.profile.accountUnavailable}
			>
				<View style={styles.identity}>
					<AppText>{user?.fullName || t.profile.account}</AppText>
					<AppText variant="footnote">
						{user?.primaryEmailAddress?.emailAddress}
					</AppText>
				</View>
			</FormSection>
			{[
				t.profile.accountDetails,
				t.profile.export,
				t.profile.deleteAccount,
			].map((label) => (
				<FormSection key={label}>
					<DisclosureRow label={label} value={t.profile.comingSoon} disabled />
				</FormSection>
			))}
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	identity: { padding: spacing.md, gap: spacing.xs },
});
