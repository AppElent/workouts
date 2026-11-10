import {
	NUTRIENT_KEYS,
	NUTRIENT_UNITS,
	type NutrientKey,
	type NutrientValue,
	roundForDisplay,
} from "@foundry/core";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import {
	countedPortion,
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
import { HEADLINE_NUTRIENTS, parseFoodNumber } from "../use-nutrient-fields";

const VALUE_KEYS = HEADLINE_NUTRIENTS;
type ValueKey = (typeof VALUE_KEYS)[number] & NutrientKey;

/** Typed values replace the estimate's; its parts no longer add up to it then. */
function withTypedValues(
	item: ReviewItem,
	typed: Partial<Record<ValueKey, string>>,
): ReviewItem {
	if (item.food) return item;
	const estimate = {
		...(Object.fromEntries(
			NUTRIENT_KEYS.map((key) => [key, { kind: "absent" }]),
		) as Record<NutrientKey, NutrientValue>),
		...item.estimate,
	};
	let changed = false;
	for (const key of VALUE_KEYS) {
		const text = typed[key];
		if (text === undefined) continue;
		const value = parseFoodNumber(text);
		if (!Number.isFinite(value) || value < 0) continue;
		estimate[key] = { kind: "value", amount: value };
		changed = true;
	}
	if (!changed) return item;
	const { components: _components, ...rest } = item;
	return { ...rest, estimate, edited: true };
}

/**
 * Adjusting one reviewed item: its amount, its values when estimated,
 * another of its candidates, or removing it. Changes apply on Klaar; ✕ leaves the item as it was.
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
	// Typed values, for this amount; an estimate can always be set by hand.
	const [typed, setTyped] = useState<Partial<Record<ValueKey, string>>>({});
	// "3 eieren" steps by the egg; a typed amount or a factor ends that.
	const [count, setCount] = useState<number>();
	useEffect(() => {
		setDraft(item);
		setCount(item ? countedPortion(item) : undefined);
		setAmount(item ? localizeDecimal(String(item.amount), locale) : "");
		setTyped({});
	}, [item, locale]);

	const parsed = parseFoodNumber(amount);
	const valid = Number.isFinite(parsed) && parsed > 0;
	const sized = draft && valid ? withAmount(draft, parsed, locale) : draft;
	const current = sized ? withTypedValues(sized, typed) : sized;
	const energy = current ? itemNutrients(current)?.energy : undefined;
	const nutrients = sized ? itemNutrients(sized) : undefined;
	// A new amount scales what was typed too, so it becomes the baseline first.
	const keepTyped = () => {
		if (current !== sized) setDraft(current);
		setTyped({});
	};
	const setFactor = (factor: number) => {
		if (!valid) return;
		setAmount(localizeDecimal(String(Math.round(parsed * factor)), locale));
		keepTyped();
		setCount(undefined);
	};
	const step = (delta: number) => {
		if (!valid || !count || count + delta < 1) return;
		const next = count + delta;
		setAmount(
			localizeDecimal(String(Math.round((parsed * next) / count)), locale),
		);
		keepTyped();
		setCount(next);
	};
	const dirty =
		current !== undefined &&
		item !== undefined &&
		(current.amount !== item.amount ||
			current.food?.id !== item.food?.id ||
			draft !== item ||
			current !== sized);
	const requestClose = () => {
		if (!dirty) {
			onClose();
			return;
		}
		Alert.alert(copy.discardTitle, undefined, [
			{ text: copy.discardKeep, style: "cancel" },
			{ text: copy.discardConfirm, style: "destructive", onPress: onClose },
		]);
	};
	// A matched food counts in its own base unit; NEVO drinks are per gram.
	const unit = draft?.unit ?? "g";

	return (
		<Modal
			visible={item !== undefined}
			presentationStyle="formSheet"
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={requestClose}
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
							onPress={requestClose}
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
							// An amount that does not read as a number stays to be fixed.
							disabled={!valid}
							onPress={() => {
								if (current && dirty) {
									// "4 eieren" stays their words. "1 broodje" has no plural to
									// reuse, so 2 of them read in grams.
									const said = item?.amountLabel.match(/^(\d+)\s+(\p{L}+)/u);
									onChange({
										...current,
										edited: true,
										...(count && count > 1 && said && Number(said[1]) > 1
											? { amountLabel: `${count} ${said[2]}` }
											: {}),
									});
								}
								onClose();
							}}
						/>
					</View>
					<FoodFormCard>
						<InlineNumberFieldRow
							label={copy.amount}
							suffix={unit}
							value={amount}
							onChangeText={(value) => {
								setAmount(value);
								setCount(undefined);
							}}
							keyboardType="decimal-pad"
							selectTextOnFocus
						/>
					</FoodFormCard>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing.sm,
							paddingHorizontal: spacing.xs,
						}}
					>
						<AppText variant="caption" style={{ flex: 1 }}>
							{[
								energy?.kind === "value"
									? `${roundForDisplay("energy", energy.amount)} kcal`
									: undefined,
								draft.food ? undefined : copy.estimatedByAi,
							]
								.filter(Boolean)
								.join(" · ")}
						</AppText>
						{count ? (
							<>
								<TextAction label={copy.oneLess} onPress={() => step(-1)} />
								<TextAction label={copy.oneMore} onPress={() => step(1)} />
							</>
						) : null}
						<TextAction label={copy.half} onPress={() => setFactor(0.5)} />
						<TextAction label={copy.double} onPress={() => setFactor(2)} />
					</View>
					{!draft.food ? (
						<>
							<FoodFormSectionHeader title={copy.values} />
							<FoodFormCard>
								{VALUE_KEYS.map((key) => {
									const value = nutrients?.[key];
									return (
										<InlineNumberFieldRow
											key={key}
											label={t.nutrition.nutrients[key]}
											suffix={NUTRIENT_UNITS[key]}
											value={
												typed[key] ??
												(value?.kind === "value"
													? localizeDecimal(
															String(roundForDisplay(key, value.amount)),
															locale,
														)
													: "")
											}
											onChangeText={(text) =>
												setTyped((previous) => ({ ...previous, [key]: text }))
											}
											keyboardType="decimal-pad"
											selectTextOnFocus
										/>
									);
								})}
							</FoodFormCard>
						</>
					) : null}
					{!current?.food && current?.components?.length ? (
						<>
							<FoodFormSectionHeader title={copy.components} />
							<FoodFormCard>
								{current.components.map((part, index) => (
									<View
										// biome-ignore lint/suspicious/noArrayIndexKey: parts have no identity
										key={index}
										style={{
											minHeight: 44,
											flexDirection: "row",
											alignItems: "center",
											gap: spacing.sm,
											paddingHorizontal: spacing.md,
											borderTopWidth: index ? 0.5 : 0,
											borderTopColor: colors.separator,
										}}
									>
										<AppText
											variant="secondary"
											style={{ flex: 1, color: colors.text }}
										>
											{part.name}
										</AppText>
										<AppText
											variant="secondary"
											style={{
												color: colors.textMuted,
												fontVariant: ["tabular-nums"],
											}}
										>
											{`${Math.round(part.grams)} g · ${roundForDisplay("energy", part.energy)} kcal`}
										</AppText>
									</View>
								))}
							</FoodFormCard>
						</>
					) : null}
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
											onPress={() =>
												setDraft({
													...replaceFood(draft, food),
													confidence: "high",
												})
											}
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
