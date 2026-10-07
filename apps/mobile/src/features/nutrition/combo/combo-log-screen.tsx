import { useState } from "react";
import { Modal, Switch, View } from "react-native";
import type { MealSlot } from "../../../data/nutrition-day";
import type { Combo } from "../../../data/personal-food-repository";
import type { useSupplementaryServings } from "../../../data/supplementary-servings";
import { fmt, useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { AmountDestination } from "../components/amount-destination";
import { AmountEditor } from "../components/amount-editor";
import { AmountEditorHeader } from "../components/amount-editor-header";
import { ComboPartEditor } from "./combo-part-editor";
import { comboTotals } from "./combo-parts";
import { useComboLog } from "./use-combo-log";

const noAdditions: ReturnType<typeof useSupplementaryServings> = {
	servings: [],
	loading: false,
	add: () => Promise.reject(new Error("A combo has no servings to add.")),
};

/**
 * Logging a combo in the one amount editor (combo §3): the capsule counts
 * whole combos, meal and date sit in the toolbar, and parts can be turned
 * off or changed for this log only. Closing without ✓ discards everything.
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
	const [adding, setAdding] = useState(false);
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
	const oncePart = combo.parts.find((part) => part.id === onceFor);
	const totalEnergy = comboTotals(combo).energy ?? 0;
	return (
		<View style={{ flex: 1, backgroundColor: colors.bg }}>
			<AmountEditorHeader
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
				choices={[]}
				additions={noAdditions}
				servingMenu={false}
				nutrients={draft.nutrients}
				factor={draft.whole.valid ? draft.whole.quantity : 1}
				referenceFactor={1}
				referenceLabel={fmt(copy.wholeCombos, { count: 1 })}
				disabled={draft.logging}
				adding={adding}
				onAddingChange={setAdding}
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
							{draft.parts.map(({ part, included, once }) => {
								const snapshot = once ?? part.snapshot;
								const energy = snapshot.nutrients.energy;
								const caption = [
									part.status === "missing"
										? `⚠ ${copy.missingPart}`
										: undefined,
									snapshot.serving[locale],
									once ? copy.onlyThisTime : undefined,
								]
									.filter(Boolean)
									.join(" · ");
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
												{energy.kind === "value" ? (
													<AppText variant="footnote">
														{Math.round(energy.amount).toLocaleString(locale)}{" "}
														kcal
													</AppText>
												) : null}
												<Switch
													accessibilityLabel={snapshot.name[locale]}
													value={included}
													onValueChange={() => draft.toggle(part.id)}
													trackColor={{ true: colors.accentFill }}
												/>
											</View>
										}
										accessibilityLabel={`${snapshot.name[locale]}, ${caption}`}
										onPress={
											part.status === "missing"
												? undefined
												: () => setOnceFor(part.id)
										}
									/>
								);
							})}
						</InsetList>
						<AppText
							variant="caption"
							style={{
								paddingHorizontal: spacing.xs,
								color: draft.blockedByMissing ? colors.danger : undefined,
							}}
						>
							{draft.blockedByMissing
								? copy.missingWaits
								: copy.partsThisTimeFooter}
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
				visible={Boolean(oncePart)}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setOnceFor(null)}
			>
				{oncePart ? (
					<ComboPartEditor
						part={
							draft.parts.find((item) => item.part.id === oncePart.id)?.once
								? {
										...oncePart,
										snapshot:
											draft.parts.find((item) => item.part.id === oncePart.id)
												?.once ?? oncePart.snapshot,
									}
								: oncePart
						}
						mode="once"
						otherEnergy={
							totalEnergy -
							(oncePart.snapshot.nutrients.energy.kind === "value"
								? oncePart.snapshot.nutrients.energy.amount
								: 0)
						}
						onCancel={() => setOnceFor(null)}
						onConfirm={(snapshot) => {
							draft.setOnce(oncePart.id, snapshot);
							setOnceFor(null);
						}}
					/>
				) : null}
			</Modal>
		</View>
	);
}
