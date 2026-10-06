import { router, Stack } from "expo-router";
import { ScrollView, View } from "react-native";
import { usePersonalFoods } from "../../../data/personal-foods";
import { fmt, useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { AppText } from "../../../ui/text";

/**
 * Every library problem with the action that fixes it: a version conflict
 * opens backup and sync, which owns resolving it; a combo with a missing
 * part opens that combo.
 */
export function LibraryAttentionScreen() {
	const { t, locale } = useI18n();
	const copy = t.nutrition.library;
	const colors = useTokens();
	const library = usePersonalFoods();
	const conflicts = library.backup.conflicts;
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
					{conflicts.map((conflict) => (
						<InsetRow
							key={`${conflict.record.kind}:${conflict.record.id}`}
							leading={{ symbol: "arrow.triangle.2.circlepath" }}
							title={
								conflict.record.kind === "food"
									? (library.find(conflict.record.id)?.name[locale] ??
										copy.conflict)
									: (library.findCombo(conflict.record.id)?.name ??
										copy.conflict)
							}
							secondary={copy.conflict}
							value={copy.conflictAction}
							chevron
							onPress={() => router.push("/nutrition-settings")}
						/>
					))}
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
									pathname: "/nutrition-combos",
									params: { comboId: combo.id },
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
