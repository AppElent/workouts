import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import type {
	Combo,
	ComboPartDraft,
} from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { useI18n } from "../../../i18n";
import { radius, spacing, type, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";

/**
 * A new combo from library foods: a name and the parts, saved with ✓ once it
 * has a name. The storage note shows only while backup is off.
 */
export function ComboNewScreen({
	parts,
	onCreated,
	onSaved,
}: {
	parts: readonly ComboPartDraft[];
	/**
	 * Runs right after the combo is saved, such as grouping the diary entries
	 * it was made from. If it throws, the new combo is removed again.
	 */
	onCreated?: (combo: Combo) => void;
	/** Where to go once saved; by default the new combo's editor. */
	onSaved?: (combo: Combo) => void;
}) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.comboEditor;
	const colors = useTokens();
	const toast = useToast();
	const library = usePersonalFoods();
	const [name, setName] = useState("");
	const [saving, setSaving] = useState(false);
	const canSave = name.trim().length > 0 && parts.length > 0 && !saving;
	const save = () => {
		if (!canSave) return;
		setSaving(true);
		try {
			const combo = library.createCombo({ name: name.trim(), parts });
			try {
				onCreated?.(combo);
			} catch (error) {
				library.removeCombo(combo.id);
				throw error;
			}
			toast.success(t.nutrition.combos.saved);
			if (onSaved) onSaved(combo);
			else
				router.replace({
					pathname: "/nutrition-combo/[id]",
					params: { id: combo.id },
				});
		} catch {
			toast.error(t.nutrition.combos.saveFailure);
			setSaving(false);
		}
	};
	return (
		<>
			<Stack.Screen
				options={{
					title: copy.newTitle,
					headerTitleStyle: { color: colors.text },
					headerRight: () => (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t.nutrition.combos.save}
							accessibilityState={{ disabled: !canSave }}
							disabled={!canSave}
							onPress={save}
							style={{
								width: 44,
								height: 44,
								borderRadius: radius.pill,
								alignItems: "center",
								justifyContent: "center",
								backgroundColor: canSave ? colors.accentFill : undefined,
								opacity: canSave ? 1 : 0.45,
							}}
						>
							<SymbolView
								name={{ ios: "checkmark", android: "check", web: "check" }}
								size={19}
								weight="semibold"
								tintColor={canSave ? colors.onAccent : colors.text}
							/>
						</Pressable>
					),
				}}
			/>
			<ScrollView
				style={{ flex: 1, backgroundColor: colors.bg }}
				contentInsetAdjustmentBehavior="automatic"
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
			>
				<View
					style={{
						backgroundColor: colors.surface,
						borderRadius: radius.contentCard,
					}}
				>
					<TextInput
						autoFocus
						accessibilityLabel={t.nutrition.combos.name}
						value={name}
						onChangeText={setName}
						placeholder={copy.name}
						placeholderTextColor={colors.textFaint}
						onSubmitEditing={save}
						style={{
							...type.secondary,
							minHeight: 50,
							paddingHorizontal: spacing.md,
							color: colors.text,
						}}
					/>
				</View>
				<AppText
					variant="footnote"
					style={{ paddingHorizontal: spacing.xs, marginTop: spacing.sm }}
				>
					{copy.parts}
				</AppText>
				<View
					style={{
						backgroundColor: colors.surface,
						borderRadius: radius.contentCard,
						overflow: "hidden",
					}}
				>
					{parts.map((part, index) => {
						const energy = part.snapshot.nutrients.energy;
						return (
							<View
								// biome-ignore lint/suspicious/noArrayIndexKey: new parts have no ids yet.
								key={index}
								style={{
									minHeight: 50,
									flexDirection: "row",
									alignItems: "center",
									paddingHorizontal: spacing.md,
									borderTopWidth: index ? 0.5 : 0,
									borderTopColor: colors.separator,
								}}
							>
								<View style={{ flex: 1 }}>
									<AppText variant="secondary" style={{ color: colors.text }}>
										{part.snapshot.name[locale]}
									</AppText>
									<AppText variant="caption">
										{part.snapshot.serving[locale]}
									</AppText>
								</View>
								{energy.kind === "value" ? (
									<AppText variant="secondary">
										{Math.round(energy.amount)} kcal
									</AppText>
								) : null}
							</View>
						);
					})}
				</View>
				{library.backup.enabled ? null : (
					<AppText variant="caption" style={{ paddingHorizontal: spacing.xs }}>
						{copy.backupOff}
					</AppText>
				)}
			</ScrollView>
		</>
	);
}
