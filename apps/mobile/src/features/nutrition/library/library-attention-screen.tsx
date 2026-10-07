import { router, Stack } from "expo-router";
import { ScrollView, View } from "react-native";
import { usePersonalFoods } from "../../../data/personal-foods";
import { fmt, useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { AppText } from "../../../ui/text";

/** Known Combos with missing source parts open their editor for repair. */
export function LibraryAttentionScreen() {
	const { t, locale } = useI18n();
	const copy = t.nutrition.library;
	const colors = useTokens();
	const library = usePersonalFoods();
	const broken = library
		.listCombos()
		.filter((combo) => combo.parts.some((part) => part.status === "missing"));
	return (
		<>
			<Stack.Screen options={{ title: copy.attention }} />
			<ScrollView
				style={{ flex: 1, backgroundColor: colors.bg }}
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
			>
				<InsetList compact>
					{broken.map((combo) => (
						<InsetRow
							key={combo.id}
							leading={{ symbol: "exclamationmark.triangle" }}
							title={combo.name}
							secondary={fmt(copy.missingPartBody, {
								part: combo.parts
									.filter((part) => part.status === "missing")
									.map((part) => part.snapshot.name[locale])
									.join(", "),
							})}
							value={copy.openCombo}
							chevron
							onPress={() =>
								router.push({
									pathname: "/nutrition-combo/[id]",
									params: { id: combo.id },
								})
							}
						/>
					))}
				</InsetList>
				<View style={{ paddingHorizontal: spacing.xs }}>
					<AppText variant="caption">{copy.attentionFooter}</AppText>
				</View>
			</ScrollView>
		</>
	);
}
