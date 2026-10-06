import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useI18n } from "../../../../i18n";
import { radius, spacing, type, useTokens } from "../../../../theme";
import { GlassSurface } from "../../../../ui/glass-surface";
import { AppText } from "../../../../ui/text";
import { NutritionKeyboardOverlay } from "../../components/nutrition-keyboard-overlay";
import { parseFoodNumber } from "../use-personal-food-draft";

/**
 * The serving card above the keyboard, as in the diary entry editor. It edits
 * the draft only; the food is written when the editor saves.
 */
export function PersonalFoodServingPopup({
	editing,
	initialName,
	initialAmount,
	unit,
	onConfirm,
	onCancel,
}: {
	editing: boolean;
	initialName: string;
	initialAmount: string;
	unit: string;
	onConfirm: (name: string, amount: string) => void;
	onCancel: () => void;
}) {
	const { t } = useI18n();
	const copy = t.nutrition.foodEditor;
	const colors = useTokens();
	const nameRef = useRef<TextInput>(null);
	const [name, setName] = useState("");
	const [amount, setAmount] = useState("");
	const [error, setError] = useState(false);
	useEffect(() => {
		const frame = requestAnimationFrame(() => nameRef.current?.focus());
		return () => cancelAnimationFrame(frame);
	}, []);
	// Empty fields keep what was there: the old value shows grey until replaced.
	const finalName = name.trim() || initialName;
	const finalAmount = amount.trim() || initialAmount;
	const valid =
		finalName.length > 0 &&
		Number.isFinite(parseFoodNumber(finalAmount)) &&
		parseFoodNumber(finalAmount) > 0;
	const field = {
		...type.secondary,
		minHeight: 44,
		paddingHorizontal: 12,
		borderRadius: radius.lg,
		backgroundColor: colors.surface2,
		color: colors.text,
	};
	return (
		<NutritionKeyboardOverlay>
			<View
				style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}
			>
				<GlassSurface
					style={{ padding: spacing.md, gap: spacing.sm, borderRadius: 26 }}
				>
					<AppText
						variant="secondary"
						style={{ fontWeight: "700", color: colors.text }}
					>
						{editing ? copy.servingEdit : copy.servingNew}
					</AppText>
					<View style={{ flexDirection: "row", gap: spacing.sm }}>
						<TextInput
							ref={nameRef}
							accessibilityLabel={copy.servingName}
							value={name}
							placeholder={initialName || copy.servingName}
							placeholderTextColor={colors.textFaint}
							onChangeText={(text) => {
								setName(text);
								setError(false);
							}}
							style={[field, { flex: 1 }]}
						/>
						<View
							style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
						>
							<TextInput
								accessibilityLabel={copy.servingAmount}
								value={amount}
								placeholder={initialAmount || "100"}
								placeholderTextColor={colors.textFaint}
								keyboardType="decimal-pad"
								onChangeText={(text) => {
									setAmount(text);
									setError(false);
								}}
								style={[field, { width: 84, textAlign: "right" }]}
							/>
							<AppText variant="footnote">{unit}</AppText>
						</View>
					</View>
					{error ? (
						<AppText
							variant="footnote"
							accessibilityRole="alert"
							style={{ color: colors.danger }}
						>
							{copy.invalidServing}
						</AppText>
					) : null}
					<View
						style={{
							flexDirection: "row",
							justifyContent: "flex-end",
							gap: spacing.sm,
						}}
					>
						<Pressable
							accessibilityRole="button"
							onPress={onCancel}
							style={{
								minHeight: 40,
								paddingHorizontal: spacing.md,
								justifyContent: "center",
							}}
						>
							<AppText style={{ color: colors.text }}>{copy.cancel}</AppText>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							accessibilityState={{ disabled: !valid }}
							onPress={() => {
								if (!valid) {
									setError(true);
									return;
								}
								onConfirm(finalName, finalAmount);
							}}
							style={{
								minHeight: 40,
								paddingHorizontal: spacing.md,
								borderRadius: radius.pill,
								backgroundColor: colors.accentFill,
								justifyContent: "center",
								opacity: valid ? 1 : 0.5,
							}}
						>
							<AppText style={{ color: colors.onAccent, fontWeight: "700" }}>
								{editing ? copy.save : copy.add}
							</AppText>
						</Pressable>
					</View>
				</GlassSurface>
			</View>
		</NutritionKeyboardOverlay>
	);
}
