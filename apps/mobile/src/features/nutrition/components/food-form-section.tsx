import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { View } from "react-native";
import { radius, spacing, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";

/** A food form's section title, with an optional menu or action on the right. */
export function FoodFormSectionHeader({
	title,
	trailing,
}: {
	title: string;
	trailing?: ReactNode;
}) {
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				marginTop: spacing.md,
				marginBottom: 2,
				paddingHorizontal: spacing.xs,
				minHeight: 32,
			}}
		>
			<AppText variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
				{title}
			</AppText>
			{trailing}
		</View>
	);
}

/** The rounded card a food form's rows sit in. */
export function FoodFormCard({ children }: { children: ReactNode }) {
	const colors = useTokens();
	return (
		<View
			style={{
				backgroundColor: colors.surface,
				borderRadius: radius.contentCard,
				borderCurve: "continuous",
				overflow: "hidden",
			}}
		>
			{children}
		</View>
	);
}

/** A menu's current value in accent with ⌃⌄, such as "per 100 g". */
export function FoodFormMenuValue({ label }: { label: string }) {
	const colors = useTokens();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 4,
				minHeight: 32,
			}}
		>
			<AppText
				variant="footnote"
				style={{ color: colors.accent, fontWeight: "700" }}
			>
				{label}
			</AppText>
			<SymbolView
				name={{
					ios: "chevron.up.chevron.down",
					android: "unfold_more",
					web: "unfold_more",
				}}
				size={10}
				weight="semibold"
				tintColor={colors.accent}
			/>
		</View>
	);
}
