/**
 * "Continue with Apple / Google / Microsoft" and the "or" rule that separates
 * them from the email form. Slots into `AuthScreen` between the submit and
 * the footer, on sign-in and sign-up alike: Clerk decides which one each
 * provider attempt turns out to be.
 */
import { StyleSheet, View } from "react-native";

import { useI18n } from "../i18n";
import { spacing, type Tokens, useThemedStyles } from "../theme";
import { GhostButton } from "../ui/button";
import { AppText } from "../ui/text";
import { AuthMessage } from "./auth-form";
import { SOCIAL_PROVIDERS, useSocialSignIn } from "./useSocialSignIn";

export function SocialButtons() {
	const copy = useI18n().t.signIn.social;
	const styles = useThemedStyles(createStyles);
	const { start, pending, error } = useSocialSignIn();

	return (
		<View style={styles.root}>
			<View style={styles.rule}>
				<View style={styles.line} />
				<AppText variant="caption">{copy.or}</AppText>
				<View style={styles.line} />
			</View>
			{SOCIAL_PROVIDERS.map((provider) => (
				<GhostButton
					key={provider}
					label={copy[provider]}
					loading={pending === provider}
					disabled={pending !== null && pending !== provider}
					onPress={() => start(provider)}
				/>
			))}
			<AuthMessage message={error} />
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { gap: spacing.sm, marginTop: spacing.sm },
		rule: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
		line: {
			flex: 1,
			height: StyleSheet.hairlineWidth,
			backgroundColor: colors.border,
		},
	});
