import { Stack } from "expo-router";
import { Pressable, View } from "react-native";
import { useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";

/**
 * Log food's header in a target mode: "Add" or "Replace" over the combo it
 * works on, and a text Done when the mode ends by choice rather than by pick.
 */
export function LogFoodTargetHeader({
	title,
	subtitle,
	doneLabel,
	onDone,
}: {
	title: string;
	subtitle: string;
	doneLabel?: string;
	onDone: () => void;
}) {
	const colors = useTokens();
	return (
		<Stack.Screen
			options={{
				title,
				headerTitle: () => (
					<View style={{ alignItems: "center" }}>
						<AppText variant="navTitle" numberOfLines={1}>
							{title}
						</AppText>
						<AppText variant="caption" numberOfLines={1}>
							{subtitle}
						</AppText>
					</View>
				),
				unstable_headerRightItems: () =>
					doneLabel
						? [
								{
									type: "button",
									label: doneLabel,
									accessibilityLabel: doneLabel,
									variant: "prominent",
									tintColor: colors.accentFill,
									onPress: onDone,
								},
							]
						: [],
				headerRight: () =>
					doneLabel ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={doneLabel}
							onPress={onDone}
							style={{ minHeight: 44, justifyContent: "center" }}
						>
							<AppText style={{ color: colors.accentInk, fontWeight: "700" }}>
								{doneLabel}
							</AppText>
						</Pressable>
					) : null,
			}}
		/>
	);
}
