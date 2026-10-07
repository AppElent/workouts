import { formatQuantity, type PersonalMeasure } from "@workouts/core/nutrition";
import { Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useI18n } from "../../../i18n";
import { radius, spacing, useTokens } from "../../../theme";
import { SkeletonBlock, SkeletonGroup } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { AmountServingPopup } from "../components/amount-serving-popup";
import { PersonalMeasuresSection } from "./components/personal-measures-section";
import {
	type MeasureUnit,
	usePersonalMeasuresEditor,
} from "./use-personal-measures-editor";

const UNITS: readonly MeasureUnit[] = ["g", "ml"];

/**
 * My measures (my-measures design): a pushed screen with the native large
 * title, one section per unit, and the shared serving popup to add or change
 * a measure above the keyboard. Offline, one status row explains why nothing
 * can change while the measures keep working for logging.
 */
export function PersonalMeasuresScreen() {
	const { t, locale } = useI18n();
	const copy = t.nutrition.personalMeasures;
	const colors = useTokens();
	const editor = usePersonalMeasuresEditor();
	const [popup, setPopup] = useState<{
		unit: MeasureUnit;
		measure?: PersonalMeasure;
	}>();
	const locked = !editor.connected || editor.pending;
	const empty = editor.byUnit.g.length === 0 && editor.byUnit.ml.length === 0;
	return (
		<>
			<Stack.Screen
				options={{
					title: copy.title,
					headerLargeTitleEnabled: true,
					headerTransparent: true,
					headerLargeTitleStyle: { color: colors.text },
					headerTitleStyle: { color: colors.text },
				}}
			/>
			<ScrollView
				style={{ flex: 1, backgroundColor: colors.bg }}
				contentInsetAdjustmentBehavior="automatic"
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{
					paddingHorizontal: spacing.md,
					paddingBottom: spacing.xxl * 3,
					gap: spacing.xs,
				}}
			>
				{!editor.connected ? (
					<View
						accessibilityRole="summary"
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 12,
							padding: spacing.md,
							marginTop: spacing.sm,
							borderRadius: radius.contentCard,
							backgroundColor: colors.surface,
						}}
					>
						<SymbolView
							name={{ ios: "wifi.slash", android: "wifi_off", web: "wifi_off" }}
							size={18}
							tintColor={colors.textMuted}
						/>
						<View style={{ flex: 1 }}>
							<AppText variant="secondary" style={{ color: colors.text }}>
								{copy.offline}
							</AppText>
							<AppText variant="caption">{copy.offlineBody}</AppText>
						</View>
					</View>
				) : null}
				{empty && !editor.loading ? (
					<AppText
						variant="footnote"
						style={{ paddingHorizontal: spacing.xs, marginTop: spacing.sm }}
					>
						{copy.intro}
					</AppText>
				) : null}
				{editor.loading ? (
					<SkeletonGroup label={copy.loading}>
						{UNITS.map((unit) => (
							<View
								key={unit}
								style={{ gap: spacing.xs, marginTop: spacing.md }}
							>
								<SkeletonBlock width="30%" height={18} />
								<SkeletonBlock height={unit === "g" ? 150 : 100} />
							</View>
						))}
					</SkeletonGroup>
				) : (
					UNITS.map((unit) => (
						<PersonalMeasuresSection
							key={unit}
							unit={unit}
							measures={editor.byUnit[unit]}
							disabled={locked}
							onAdd={() => setPopup({ unit })}
							onEdit={(measure) => setPopup({ unit, measure })}
							onMove={(measure, direction) =>
								void editor.move(measure, direction)
							}
							onRemove={(measure) => void editor.remove(measure)}
						/>
					))
				)}
			</ScrollView>
			{popup ? (
				<AmountServingPopup
					key={popup.measure?.id ?? `new-${popup.unit}`}
					name={popup.measure?.name ?? ""}
					unit={popup.unit}
					initial={
						popup.measure
							? {
									name: popup.measure.name,
									amount: formatQuantity(popup.measure.amount, locale),
								}
							: undefined
					}
					measure={{
						title: popup.measure ? copy.edit : copy.add,
						confirmLabel: popup.measure ? copy.save : copy.confirmAdd,
						help: copy.help,
						confirmUnitChange: popup.measure
							? editor.confirmUnitChange
							: undefined,
						onSubmit: async (value) => {
							await editor.save(popup.measure, value);
							setPopup(undefined);
						},
					}}
					onCancel={() => setPopup(undefined)}
				/>
			) : null}
		</>
	);
}
