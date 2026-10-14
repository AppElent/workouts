import { roundForDisplay } from "@foundry/core/nutrition";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import {
	itemNutrients,
	type ReviewItem,
	replaceFood,
	withAmount,
} from "../../../data/nutrition-ai";
import {
	modalAnimation,
	useReduceMotion,
} from "../../../feedback/reduce-motion";
import { localizeDecimal, useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { InlineNumberFieldRow, TextAction } from "../../../ui/form";
import { AppText } from "../../../ui/text";
import {
	FoodFormCard,
	FoodFormSectionHeader,
} from "../components/food-form-section";
import { parseFoodNumber } from "../use-nutrient-fields";

/**
 * Adjusting one reviewed item: its amount, another of its candidates, or
 * removing it. Changes apply on Klaar; ✕ leaves the item as it was.
 */
export function AssistanceItemSheet({
	item,
	onChange,
	onRemove,
	onClose,
}: {
	item: ReviewItem | undefined;
	onChange: (item: ReviewItem) => void;
	onRemove: () => void;
	onClose: () => void;
}) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.assistance;
	const colors = useTokens();
	const reduceMotion = useReduceMotion();
	const [draft, setDraft] = useState(item);
	const [amount, setAmount] = useState("");
	useEffect(() => {
		setDraft(item);
		setAmount(item ? localizeDecimal(String(item.amount), locale) : "");
	}, [item, locale]);

	const parsed = parseFoodNumber(amount);
	const valid = Number.isFinite(parsed) && parsed > 0;
	const current = draft && valid ? withAmount(draft, parsed, locale) : draft;
	const energy = current ? itemNutrients(current)?.energy : undefined;
	const unit = draft?.food?.baseUnit === "ml" ? "ml" : (draft?.unit ?? "g");

	return (
		<Modal
			visible={item !== undefined}
			presentationStyle="formSheet"
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={onClose}
		>
			{draft ? (
				<ScrollView
					style={{ flex: 1, backgroundColor: colors.bg }}
					keyboardShouldPersistTaps="handled"
					contentContainerStyle={{ padding: spacing.md, gap: spacing.xs }}
				>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing.sm,
						}}
					>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={copy.cancel}
							onPress={onClose}
							style={{ width: 44, height: 44, justifyContent: "center" }}
						>
							<SymbolView
								name={{ ios: "xmark", android: "close", web: "close" }}
								size={17}
								tintColor={colors.text}
							/>
						</Pressable>
						<AppText
							variant="navTitle"
							accessibilityRole="header"
							style={{ flex: 1, textAlign: "center" }}
							numberOfLines={1}
						>
							{draft.food?.name[locale] ?? draft.described}
						</AppText>
						<TextAction
							label={copy.done}
							onPress={() => {
								if (current && valid) onChange(current);
								onClose();
							}}
						/>
					</View>
					<FoodFormCard>
						<InlineNumberFieldRow
							label={copy.amount}
							suffix={unit}
							value={amount}
							onChangeText={setAmount}
							keyboardType="decimal-pad"
							selectTextOnFocus
						/>
					</FoodFormCard>
					<AppText variant="caption" style={{ paddingHorizontal: spacing.xs }}>
						{[
							energy?.kind === "value"
								? `${roundForDisplay("energy", energy.amount)} kcal`
								: undefined,
							draft.food ? undefined : copy.estimatedByAi,
						]
							.filter(Boolean)
							.join(" · ")}
					</AppText>
					{draft.candidates.length ? (
						<>
							<FoodFormSectionHeader title={copy.otherCandidates} />
							<FoodFormCard>
								{draft.candidates.map((food, index) => {
									const chosen = food.id === draft.food?.id;
									const kcal = food.nutrients.energy;
									return (
										<Pressable
											key={food.id}
											accessibilityRole="button"
											accessibilityState={{ selected: chosen }}
											onPress={() => setDraft(replaceFood(draft, food))}
											style={{
												minHeight: 50,
												flexDirection: "row",
												alignItems: "center",
												gap: spacing.sm,
												paddingHorizontal: spacing.md,
												borderTopWidth: index ? 0.5 : 0,
												borderTopColor: colors.separator,
											}}
										>
											<View style={{ flex: 1, paddingVertical: spacing.sm }}>
												<AppText
													variant="secondary"
													style={{ color: colors.text }}
												>
													{food.name[locale]}
												</AppText>
												{kcal.kind === "value" ? (
													<AppText variant="caption">
														{`${roundForDisplay("energy", kcal.amount)} kcal / 100 ${food.baseUnit}`}
													</AppText>
												) : null}
											</View>
											{chosen ? (
												<SymbolView
													name={{
														ios: "checkmark",
														android: "check",
														web: "check",
													}}
													size={16}
													tintColor={colors.accent}
												/>
											) : null}
										</Pressable>
									);
								})}
							</FoodFormCard>
						</>
					) : null}
					<View style={{ marginTop: spacing.lg }}>
						<FoodFormCard>
							<Pressable
								accessibilityRole="button"
								onPress={onRemove}
								style={{
									minHeight: 50,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<AppText variant="secondary" style={{ color: colors.danger }}>
									{copy.removeItem}
								</AppText>
							</Pressable>
						</FoodFormCard>
					</View>
				</ScrollView>
			) : null}
		</Modal>
	);
}
