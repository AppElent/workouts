import { formatQuantity } from "@foundry/core/nutrition";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import {
	Keyboard,
	Pressable,
	TextInput,
	type TextInputInstance,
	View,
} from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { radius, spacing, type, useTokens } from "../../../theme";
import { GlassSurface } from "../../../ui/glass-surface";
import { AppText } from "../../../ui/text";
import { NutritionKeyboardOverlay } from "./nutrition-keyboard-overlay";

/** Round 5 replacement entry: an empty editing buffer never erases the saved draft. */
export function AmountQuantity({
	value,
	amount,
	unit,
	baseUnitSelected,
	valid,
	disabled,
	onChange,
	onEditingChange,
	step: stepSize,
}: {
	/**
	 * What the small − and + change by (quarters by default); the large ones
	 * change by one. With a base unit selected: ones and tens.
	 */
	step?: number;
	value: string;
	amount: number;
	unit: string;
	baseUnitSelected: boolean;
	valid: boolean;
	disabled: boolean;
	onChange: (value: string) => void;
	onEditingChange: (editing: boolean) => void;
}) {
	const { t, locale } = useI18n();
	const colors = useTokens();
	const [buffer, setBuffer] = useState<string | null>(null);
	const original = useRef(value);
	const input = useRef<TextInputInstance>(null);
	function change(text: string) {
		setBuffer(text);
		onChange(text === "" ? original.current : text);
	}
	function choose(next: number) {
		input.current?.blur();
		setBuffer(null);
		onChange(String(next));
		Keyboard.dismiss();
	}
	const small = baseUnitSelected ? 1 : (stepSize ?? 0.25);
	const large = baseUnitSelected ? 10 : 1;
	const move = (by: number) =>
		choose(
			Math.max(
				baseUnitSelected ? 0.1 : small,
				(valid ? Number(value.replace(",", ".")) : 0) + by,
			),
		);
	const smallLabel = formatQuantity(small, locale);
	const fine = (direction: -1 | 1) => (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={fmt(
				direction < 0 ? t.diaryEntry.lessBy : t.diaryEntry.moreBy,
				{ step: smallLabel },
			)}
			disabled={disabled}
			accessibilityState={{ disabled }}
			hitSlop={4}
			onPress={() => move(direction * small)}
			style={({ pressed }) => ({
				minWidth: 40,
				height: 40,
				paddingHorizontal: 6,
				borderRadius: radius.pill,
				backgroundColor: pressed ? colors.surface : colors.surface2,
				alignItems: "center",
				justifyContent: "center",
				opacity: disabled ? 0.4 : 1,
			})}
		>
			<AppText
				variant="footnote"
				style={{ color: colors.text, fontWeight: "600" }}
			>
				{`${direction < 0 ? "−" : "+"}${small === 0.25 ? "¼" : small === 0.5 ? "½" : smallLabel}`}
			</AppText>
		</Pressable>
	);
	const step = (direction: -1 | 1) => (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={direction < 0 ? t.diaryEntry.less : t.diaryEntry.more}
			disabled={disabled}
			accessibilityState={{ disabled }}
			onPress={() => move(direction * large)}
			style={({ pressed }) => ({
				width: 72,
				height: 72,
				borderRadius: radius.pill,
				backgroundColor: pressed ? colors.surface2 : colors.surface,
				alignItems: "center",
				justifyContent: "center",
				opacity: disabled ? 0.4 : 1,
				boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
			})}
		>
			<SymbolView
				name={
					direction < 0
						? { ios: "minus", android: "remove", web: "remove" }
						: { ios: "plus", android: "add", web: "add" }
				}
				tintColor={colors.text}
				size={28}
			/>
		</Pressable>
	);
	return (
		<GlassSurface
			capsule
			style={{
				flexDirection: "row",
				alignItems: "center",
				paddingHorizontal: 10,
				gap: 4,
				minHeight: 104,
			}}
		>
			{step(-1)}
			{fine(-1)}
			<View
				style={{
					flex: 1,
					minWidth: 0,
					alignItems: "center",
					paddingVertical: spacing.sm,
				}}
			>
				<TextInput
					ref={input}
					accessibilityLabel={t.nutrition.foodBrowser.quantity}
					value={buffer === null ? value : buffer}
					placeholder={buffer === null ? undefined : original.current}
					placeholderTextColor={`${colors.textMuted}80`}
					selectionColor={colors.accent}
					onFocus={() => {
						original.current = value;
						setBuffer("");
						onEditingChange(true);
					}}
					onBlur={() => {
						setBuffer(null);
						onEditingChange(false);
					}}
					onChangeText={change}
					keyboardType="decimal-pad"
					editable={!disabled}
					style={{
						...type.quantityCompact,
						color: buffer === null ? colors.text : colors.accent,
						textAlign: "center",
						width: "100%",
						padding: 0,
						fontVariant: ["tabular-nums"],
					}}
				/>
				<AppText
					variant="footnote"
					style={{ alignSelf: "stretch", textAlign: "center" }}
				>
					{valid ? formatQuantity(amount, locale) : "—"} {unit}
				</AppText>
			</View>
			{fine(1)}
			{step(1)}
		</GlassSurface>
	);
}

/** Above-keyboard presets share the same safe host boundary as serving creation. */
export function AmountQuantityAccessory({
	baseUnitSelected,
	visible,
	onChange,
}: {
	baseUnitSelected: boolean;
	visible: boolean;
	onChange: (value: string) => void;
}) {
	const { t, locale } = useI18n();
	const colors = useTokens();
	function choose(value: number) {
		onChange(String(value));
		Keyboard.dismiss();
	}
	return (
		<NutritionKeyboardOverlay>
			{visible && (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing.sm,
						paddingHorizontal: 10,
						paddingVertical: spacing.sm,
					}}
				>
					<View
						style={{
							flex: 1,
							flexDirection: "row",
							flexWrap: "wrap",
							gap: spacing.sm,
						}}
					>
						{(baseUnitSelected
							? [100, 150, 200, 250, 300]
							: [0.5, 1, 1.5, 2, 3]
						).map((next) => (
							<GlassSurface capsule key={next}>
								<Pressable
									accessibilityRole="button"
									onPress={() => choose(next)}
									style={({ pressed }) => ({
										minHeight: 44,
										minWidth: 44,
										paddingHorizontal: 12,
										borderRadius: radius.pill,
										opacity: pressed ? 0.6 : 1,
										alignItems: "center",
										justifyContent: "center",
									})}
								>
									<AppText style={{ fontWeight: "600" }}>
										{formatQuantity(next, locale)}
									</AppText>
								</Pressable>
							</GlassSurface>
						))}
					</View>
					<GlassSurface capsule tint={colors.accentFill}>
						<Pressable
							accessibilityRole="button"
							onPress={() => {
								Keyboard.dismiss();
							}}
							style={{
								minHeight: 44,
								paddingHorizontal: spacing.md,
								borderRadius: radius.pill,
								justifyContent: "center",
							}}
						>
							<AppText style={{ color: colors.onAccent, fontWeight: "700" }}>
								{t.diaryEntry.done}
							</AppText>
						</Pressable>
					</GlassSurface>
				</View>
			)}
		</NutritionKeyboardOverlay>
	);
}
