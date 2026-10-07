import {
	forkSource,
	NEVO_ATTRIBUTION,
	SALT_DERIVATION_DISCLOSURE,
} from "@workouts/core/nutrition";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useRef, useState } from "react";
import { View } from "react-native";
import type { DiaryEntry, MealSlot } from "../../../../data/nutrition-day";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../../../../data/nutrition-operation-service";
import {
	portionMemoryFor,
	rememberedSelection,
} from "../../../../data/nutrition-shortcuts";
import { usePersonalMeasures } from "../../../../data/personal-measures";
import { useSupplementaryServings } from "../../../../data/supplementary-servings";
import { haptics } from "../../../../feedback/haptics";
import { fmt, useI18n } from "../../../../i18n";
import { spacing, useTokens } from "../../../../theme";
import { GlassSurface } from "../../../../ui/glass-surface";
import { AppText } from "../../../../ui/text";
import { useToast } from "../../../../ui/toast";
import { AmountDestination } from "../../components/amount-destination";
import { AmountEditor } from "../../components/amount-editor";
import { AmountEditorHeader } from "../../components/amount-editor-header";
import { NutritionChoiceMenu } from "../../components/nutrition-choice-menu";
import { useAmountSelection } from "../../components/use-amount-selection";
import {
	createFoodSnapshot,
	type FoodSelection,
	type LogOutcome,
	selectionSourceKey,
	servingChoices,
	servingPreview,
} from "../log-food-selection";

/**
 * Logging a food from Log food, in the one amount editor: the same capsule,
 * serving menu and product card as editing a diary entry. ✓ logs and returns
 * to the results; meal and date sit in the toolbar, the rest in ⋯.
 */
export function LogFoodAmountSheet({
	selection,
	meal,
	date,
	onBack,
	onLogged,
	onPendingChange,
	onEdit,
	onDelete,
	onCorrect,
}: {
	selection: FoodSelection;
	meal: MealSlot;
	date: string;
	onBack: () => void;
	onLogged: (outcome: LogOutcome, foodName: string, entry: DiaryEntry) => void;
	onPendingChange: (pending: boolean) => void;
	onEdit?: () => void;
	onDelete?: () => void;
	/** Start a correction of this shipped food. Absent for a local food. */
	onCorrect?: () => void;
}) {
	const { t, locale } = useI18n();
	const colors = useTokens();
	const router = useRouter();
	const toast = useToast();
	const operations = useNutritionOperations();
	const measures = usePersonalMeasures();
	const food = selection.food;
	const additions = useSupplementaryServings(
		selection.kind === "shipped" ? food.id : undefined,
	);
	const choices = useMemo(
		() => servingChoices(selection, measures, additions.servings),
		[measures, selection, additions.servings],
	);
	const subject = operations.getSubject();
	const sourceKey = selectionSourceKey(selection);
	const remembered = useMemo(
		() =>
			rememberedSelection(
				choices,
				food.baseUnit,
				subject
					? operations.getShortcut(subject, sourceKey)?.portion
					: undefined,
			),
		[choices, food.baseUnit, operations, sourceKey, subject],
	);
	const [initial] = useState(() => {
		const option =
			remembered?.option ??
			choices.find((choice) => choice.kind !== "personal-measure") ??
			choices[0];
		const quantity =
			remembered?.quantity ??
			(option.kind === "base-unit" && option.unit !== "serving" ? 100 : 1);
		return { option, quantity, amount: option.amount * quantity };
	});
	const amount = useAmountSelection(initial);
	const [destination, setDestination] = useState({ meal, date });
	const [favorite, setFavorite] = useState(() =>
		subject
			? Boolean(operations.getShortcut(subject, sourceKey)?.favorite)
			: false,
	);
	const [adding, setAdding] = useState(false);
	const [logging, setLogging] = useState(false);
	const lock = useRef(false);
	const preview = servingPreview(
		selection,
		amount.selected,
		amount.valid ? amount.quantity : 1,
		locale,
	);
	const correctedSource =
		selection.kind === "personal" ? forkSource(selection.food) : undefined;

	function log(outcome: LogOutcome) {
		if (!amount.valid || lock.current) return;
		lock.current = true;
		setLogging(true);
		onPendingChange(true);
		const fail = () => {
			lock.current = false;
			setLogging(false);
			onPendingChange(false);
			toast.error(t.nutrition.foodBrowser.logFailure);
		};
		try {
			if (!subject) throw new Error("Not signed in.");
			const clientEntryId = mintNutritionUuid();
			const { common, provenance } = createFoodSnapshot(
				selection,
				amount.selected,
				amount.quantity,
				destination.date,
				destination.meal,
				clientEntryId,
				locale,
			);
			operations.create(
				subject,
				{ ...common, provenance },
				{
					sourceKey,
					portion: portionMemoryFor(
						amount.selected,
						amount.quantity,
						food.baseUnit,
					),
				},
				fail,
				() => {
					haptics.entryLogged();
					lock.current = false;
					setLogging(false);
					onPendingChange(false);
					onLogged(outcome, food.name[locale], {
						id: `client:${clientEntryId}`,
						...common,
						provenance,
					});
				},
			);
		} catch {
			fail();
		}
	}

	const reference = food.baseUnit === "serving" ? 1 : 100;
	const menuItems = [
		[
			{
				id: "favorite",
				label: favorite
					? t.nutrition.foodBrowser.removeFavorite
					: t.nutrition.foodBrowser.favorite,
			},
			{ id: "close", label: t.nutrition.foodBrowser.addAndClose },
		],
		[
			...(onCorrect
				? [{ id: "correct", label: t.nutrition.fork.correct }]
				: []),
			...(onEdit
				? [{ id: "edit", label: t.nutrition.personalFood.editTitle }]
				: []),
			...(onDelete
				? [
						{
							id: "delete",
							label: t.nutrition.personalFood.delete,
							destructive: true,
						},
					]
				: []),
		],
	].filter((section) => section.length > 0);

	return (
		<View style={{ flex: 1, backgroundColor: colors.bg }}>
			<AmountEditorHeader
				title={food.name[locale]}
				closeLabel={t.nutrition.foodBrowser.closeServingLabel}
				confirmLabel={t.nutrition.foodBrowser.addAndContinue}
				canConfirm={amount.valid}
				busy={logging}
				busyLabel={t.nutrition.foodBrowser.logging}
				disabled={adding}
				onClose={onBack}
				onConfirm={() => log("continue")}
			/>
			<AmountEditor
				name={food.name[locale]}
				visual={"visual" in food ? food.visual : undefined}
				unit={food.baseUnit}
				selection={amount}
				choices={choices}
				source={food}
				additions={additions}
				nutrients={preview.nutrients}
				allNutrients
				factor={1}
				referenceFactor={reference / (amount.valid ? amount.amount : reference)}
				referenceLabel={`${reference} ${food.baseUnit}`}
				onOpenDetails={() =>
					router.push({
						pathname: "/nutrition-food-details",
						params: { source: selection.kind, id: food.id },
					})
				}
				below={
					selection.kind === "shipped" || correctedSource ? (
						<View style={{ gap: spacing.xs, paddingHorizontal: spacing.xs }}>
							{correctedSource ? (
								<>
									<AppText variant="caption">
										{fmt(t.nutrition.fork.forkedFrom, {
											name: correctedSource.sourceName[locale],
										})}
									</AppText>
									<AppText variant="caption">
										{selection.kind === "personal" &&
										selection.food.provenance.locallyEdited
											? t.nutrition.fork.locallyEdited
											: t.nutrition.fork.unchanged}
									</AppText>
								</>
							) : null}
							<AppText variant="caption">{NEVO_ATTRIBUTION}</AppText>
							<AppText variant="caption">
								{SALT_DERIVATION_DISCLOSURE[locale]}
							</AppText>
						</View>
					) : null
				}
				disabled={logging}
				adding={adding}
				onAddingChange={setAdding}
				toolbar={
					<>
						<AmountDestination
							meal={destination.meal}
							date={destination.date}
							disabled={logging || adding}
							onMealChange={(next) =>
								setDestination((current) => ({ ...current, meal: next }))
							}
							onDateChange={(next) =>
								setDestination((current) => ({ ...current, date: next }))
							}
						/>
						<View style={{ flex: 1 }} />
						<GlassSurface capsule>
							<NutritionChoiceMenu
								accessibilityLabel={t.nutrition.foodEditor.more}
								sections={menuItems}
								onSelect={(id) => {
									if (id === "favorite") {
										if (!subject) return;
										operations.toggleFavorite(subject, sourceKey, !favorite);
										setFavorite(!favorite);
									} else if (id === "close") log("close");
									else if (id === "correct") onCorrect?.();
									else if (id === "edit") onEdit?.();
									else if (id === "delete") onDelete?.();
								}}
							>
								<View
									style={{
										width: 44,
										height: 44,
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<SymbolView
										name={{
											ios: "ellipsis",
											android: "more_horiz",
											web: "more_horiz",
										}}
										size={19}
										tintColor={colors.text}
									/>
								</View>
							</NutritionChoiceMenu>
						</GlassSurface>
					</>
				}
			/>
		</View>
	);
}
