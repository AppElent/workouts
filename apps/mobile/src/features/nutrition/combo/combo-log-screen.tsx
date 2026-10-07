import { useState } from "react";
import { Modal, Switch, View } from "react-native";
import type { MealSlot } from "../../../data/nutrition-day";
import type { Combo } from "../../../data/personal-food-repository";
import { fmt, useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { AmountDestination } from "../components/amount-destination";
import { AmountEditor } from "../components/amount-editor";
import { AmountSheetHeader } from "../components/amount-sheet-header";
import { ComboPartEditor } from "./combo-part-editor";
import { kcalText, snapshotEnergy } from "./combo-parts";
import { useComboLog } from "./use-combo-log";

/**
 * Logging a combo in the one amount editor (combo §3): the capsule counts
 * whole combos in halves, meal and date sit in the toolbar, and parts can be
 * turned off or changed for this log only. A part whose source is gone stays
 * off. Closing without ✓ discards everything.
 */
export function ComboLogScreen({
	combo,
	meal,
	date,
	onClose,
}: {
	combo: Combo;
	meal: MealSlot;
	date: string;
	onClose: () => void;
}) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.comboEditor;
	const colors = useTokens();
	const toast = useToast();
	const [onceFor, setOnceFor] = useState<string | null>(null);
	const draft = useComboLog({
		combo,
		meal,
		date,
		onLogged: () => {
			toast.success(fmt(copy.logged, { name: combo.name }));
			onClose();
		},
		onFailed: () => toast.error(copy.logFailure),
	});
	const once = draft.parts.find(({ part }) => part.id === onceFor);
	const thisTime = draft.included.reduce(
		(sum, { snapshot }) => sum + snapshotEnergy(snapshot),
		0,
	);
	const missingNames = draft.missing.map((part) => part.snapshot.name[locale]);
	const footer = [
		copy.partsThisTimeFooter,
		missingNames.length === 1
			? fmt(copy.missingOff, { name: missingNames[0] })
			: missingNames.length > 1
				? fmt(copy.missingOffMany, { names: missingNames.join(", ") })
				: undefined,
	]
		.filter(Boolean)
		.join(" ");
	return (
		<View style={{ flex: 1, backgroundColor: colors.bg }}>
			<AmountSheetHeader
				title={combo.name}
				subtitle={copy.logTitle}
				closeLabel={copy.cancel}
				confirmLabel={t.nutrition.combos.log}
				canConfirm={draft.canLog}
				busy={draft.logging}
				busyLabel={t.nutrition.combos.logging}
				onClose={onClose}
				onConfirm={draft.log}
			/>
			<AmountEditor
				name={combo.name}
				unit="serving"
				selection={draft.whole}
				quantity={{ unit: copy.wholeUnit, step: 0.5 }}
				table={{
					nutrients: draft.nutrients,
					factor: draft.whole.valid ? draft.whole.quantity : 1,
					referenceFactor: 1,
					referenceLabel: copy.wholeCombo,
					valueLabel: copy.thisTime,
				}}
				caption={fmt(copy.partsIncluded, {
					count: draft.included.length,
					total: combo.parts.length,
				})}
				disabled={draft.logging}
				below={
					<View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
						<AppText
							variant="footnote"
							accessibilityRole="header"
							style={{ paddingHorizontal: spacing.xs }}
						>
							{copy.partsThisTime}
						</AppText>
						<InsetList compact>
							{draft.parts.map(({ part, included, once, snapshot }) => {
								const missing = part.status === "missing";
								const caption = [
									missing ? `⚠ ${copy.missingPart}` : undefined,
									snapshot.serving[locale],
									once ? copy.onlyThisTime : undefined,
								]
									.filter(Boolean)
									.join(" · ");
								const kcal = kcalText(snapshot.nutrients.energy, locale);
								return (
									<InsetRow
										key={part.id}
										id={part.id}
										title={snapshot.name[locale]}
										secondary={caption}
										trailing={
											<View
												style={{
													flexDirection: "row",
													alignItems: "center",
													gap: spacing.sm,
												}}
											>
												{kcal ? (
													<AppText variant="footnote">{kcal}</AppText>
												) : null}
												<Switch
													accessibilityLabel={snapshot.name[locale]}
													value={included}
													disabled={missing || draft.logging}
													onValueChange={() => draft.toggle(part)}
													trackColor={{ true: colors.accentFill }}
												/>
											</View>
										}
										accessibilityLabel={`${snapshot.name[locale]}, ${caption}`}
										onPress={missing ? undefined : () => setOnceFor(part.id)}
									/>
								);
							})}
						</InsetList>
						<AppText
							variant="caption"
							style={{ paddingHorizontal: spacing.xs }}
						>
							{footer}
						</AppText>
					</View>
				}
				toolbar={
					<AmountDestination
						meal={draft.destination.meal}
						date={draft.destination.date}
						disabled={draft.logging}
						onMealChange={draft.setMeal}
						onDateChange={draft.setDate}
					/>
				}
			/>
			<Modal
				visible={Boolean(once)}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setOnceFor(null)}
			>
				{once ? (
					<ComboPartEditor
						part={{ ...once.part, snapshot: once.snapshot }}
						mode="once"
						total={{
							name: combo.name,
							before: thisTime,
							others: once.included
								? thisTime - snapshotEnergy(once.snapshot)
								: thisTime,
						}}
						onCancel={() => setOnceFor(null)}
						onConfirm={(snapshot) => {
							draft.setOnce(once.part.id, snapshot);
							setOnceFor(null);
						}}
					/>
				) : null}
			</Modal>
		</View>
	);
}
