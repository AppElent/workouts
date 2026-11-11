import { Stack, useRouter } from "expo-router";
import { View } from "react-native";
import { useI18n } from "../../../i18n";
import { radius, spacing, useTokens } from "../../../theme";
import {
	DisclosureRow,
	FormScreen,
	FormSection,
	TextAction,
} from "../../../ui/form";
import { AppText } from "../../../ui/text";

/**
 * The first-run sheet for an empty account (`use-first-run-prompt.ts`). It
 * leads to the existing goal editor, which returns to the diary on save; a
 * workout instead opens Train. Skip, or a swipe down, leaves the app as it
 * is: goals stay reachable from Profile.
 */
export function FirstRunScreen() {
	const { t } = useI18n();
	const copy = t.firstRun;
	const router = useRouter();
	const close = () =>
		router.canGoBack() ? router.back() : router.replace("/");

	return (
		<>
			<Stack.Screen
				options={{
					title: "",
					headerRight: () => (
						<TextAction label={copy.skip} tone="neutral" onPress={close} />
					),
				}}
			/>
			<FormScreen
				nativeSheet
				primaryAction={{
					label: copy.setGoals,
					onPress: () =>
						router.push({
							pathname: "/nutrition-goals",
							params: { returnTo: "diary" },
						}),
				}}
			>
				<View testID="first-run-screen" style={{ gap: spacing.sm }}>
					<AppText variant="title" accessibilityRole="header">
						{copy.title}
					</AppText>
					<AppText variant="secondary">{copy.body}</AppText>
				</View>
				<FormSection title={copy.steps}>
					<Step number={1} title={copy.goalsStep} hint={copy.goalsHint} />
					<Step number={2} title={copy.logStep} hint={copy.logHint} />
				</FormSection>
				<FormSection footer={copy.later}>
					<DisclosureRow
						label={copy.workoutInstead}
						onPress={() => router.dismissTo("/train")}
					/>
				</FormSection>
			</FormScreen>
		</>
	);
}

function Step({
	number,
	title,
	hint,
}: {
	number: number;
	title: string;
	hint: string;
}) {
	const colors = useTokens();
	return (
		<View
			accessible
			accessibilityLabel={`${number}. ${title}. ${hint}`}
			style={{
				flexDirection: "row",
				alignItems: "flex-start",
				gap: spacing.md,
				paddingHorizontal: spacing.md,
				paddingVertical: 12,
			}}
		>
			<View
				style={{
					minWidth: 28,
					paddingHorizontal: 6,
					paddingVertical: 2,
					borderRadius: radius.pill,
					backgroundColor: colors.accentFill,
					alignItems: "center",
				}}
			>
				<AppText variant="label" style={{ color: colors.onAccent }}>
					{String(number)}
				</AppText>
			</View>
			<View style={{ flex: 1, gap: 2 }}>
				<AppText variant="body">{title}</AppText>
				<AppText variant="footnote" style={{ color: colors.textMuted }}>
					{hint}
				</AppText>
			</View>
		</View>
	);
}
