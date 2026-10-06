import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";
import { spacing, useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";

/** At this text size the fields move under the name instead of squeezing it. */
const STACK_FONT_SCALE = 1.35;

/** Name and kind on the left; one or two number fields and the unit on the right. */
export function GoalRow({
	name,
	kind,
	fields,
	unit,
	error,
}: {
	name: string;
	kind: ReactNode;
	fields: ReactNode;
	unit: string;
	error?: string;
}) {
	const colors = useTokens();
	const stacked = useWindowDimensions().fontScale >= STACK_FONT_SCALE;
	return (
		<View
			style={{
				paddingHorizontal: spacing.md,
				paddingVertical: 10,
				gap: spacing.xs,
				backgroundColor: colors.surface,
			}}
		>
			<View
				style={{
					flexDirection: stacked ? "column" : "row",
					alignItems: stacked ? "flex-start" : "center",
					gap: spacing.sm,
				}}
			>
				<View style={{ flex: stacked ? undefined : 1, minWidth: 0 }}>
					<AppText variant="secondary" style={{ color: colors.text }}>
						{name}
					</AppText>
					{kind}
				</View>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 6,
						alignSelf: stacked ? "flex-end" : undefined,
					}}
				>
					{fields}
					<AppText variant="footnote" style={{ minWidth: 30 }}>
						{unit}
					</AppText>
				</View>
			</View>
			{error ? (
				<AppText
					variant="footnote"
					accessibilityRole="alert"
					style={{ color: colors.danger }}
				>
					{error}
				</AppText>
			) : null}
		</View>
	);
}

/** The visible kind label (`Range ⌄`) that opens the kind menu. */
export function GoalKindLabel({ label }: { label: string }) {
	const colors = useTokens();
	return (
		<View
			style={{
				minHeight: 24,
				flexDirection: "row",
				alignItems: "center",
				gap: 3,
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
					ios: "chevron.down",
					android: "expand_more",
					web: "expand_more",
				}}
				size={9}
				weight="bold"
				tintColor={colors.accent}
			/>
		</View>
	);
}
