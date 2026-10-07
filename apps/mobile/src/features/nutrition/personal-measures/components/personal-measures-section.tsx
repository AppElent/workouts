import { formatQuantity, type PersonalMeasure } from "@workouts/core/nutrition";
import { SymbolView } from "expo-symbols";
import { Pressable, View } from "react-native";
import { fmt, useI18n } from "../../../../i18n";
import { radius, spacing, useTokens } from "../../../../theme";
import { InsetList, InsetRow } from "../../../../ui/inset-list";
import type { RowAction } from "../../../../ui/swipeable-row";
import { AppText } from "../../../../ui/text";
import type { MeasureUnit } from "../use-personal-measures-editor";

/**
 * One unit's measures (my-measures design §1–2): the section title with its
 * own +, which presets the unit, and the rule as the footer. A tap changes a
 * measure; swipe offers only Delete and a full swipe runs nothing; long
 * press adds Change and Move up/down within this unit (absent at the ends).
 */
export function PersonalMeasuresSection({
	unit,
	measures,
	disabled,
	onAdd,
	onEdit,
	onMove,
	onRemove,
}: {
	unit: MeasureUnit;
	measures: readonly PersonalMeasure[];
	/** Offline or saving: the list stays readable, nothing changes it. */
	disabled: boolean;
	onAdd: () => void;
	onEdit: (measure: PersonalMeasure) => void;
	onMove: (measure: PersonalMeasure, direction: -1 | 1) => void;
	onRemove: (measure: PersonalMeasure) => void;
}) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.personalMeasures;
	const colors = useTokens();
	const title = unit === "g" ? copy.weight : copy.volume;
	const actions = (measure: PersonalMeasure, index: number): RowAction[] =>
		disabled
			? []
			: [
					{
						key: "edit",
						label: copy.editAction,
						systemImage: "pencil",
						swipe: false,
						onPress: () => onEdit(measure),
					},
					...(index > 0
						? [
								{
									key: "up",
									label: copy.moveUp,
									systemImage: "arrow.up" as const,
									swipe: false,
									onPress: () => onMove(measure, -1),
								},
							]
						: []),
					...(index < measures.length - 1
						? [
								{
									key: "down",
									label: copy.moveDown,
									systemImage: "arrow.down" as const,
									swipe: false,
									dividerAfter: true,
									onPress: () => onMove(measure, 1),
								},
							]
						: []),
					{
						key: "delete",
						label: copy.delete,
						systemImage: "trash",
						destructive: true,
						onPress: () => onRemove(measure),
					},
				];
	return (
		<View style={{ gap: spacing.xs }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					paddingHorizontal: spacing.xs,
					marginTop: spacing.md,
				}}
			>
				<AppText
					variant="heading"
					accessibilityRole="header"
					style={{ flex: 1 }}
				>
					{title}
				</AppText>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={fmt(copy.addIn, { unit })}
					accessibilityState={{ disabled }}
					disabled={disabled}
					onPress={onAdd}
					style={{
						width: 44,
						height: 44,
						borderRadius: radius.pill,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: colors.surface2,
						opacity: disabled ? 0.4 : 1,
					}}
				>
					<SymbolView
						name={{ ios: "plus", android: "add", web: "add" }}
						size={18}
						weight="semibold"
						tintColor={colors.accentInk}
					/>
				</Pressable>
			</View>
			<InsetList compact footer={copy.help[unit]}>
				{measures.length === 0 ? (
					<InsetRow id={`example-${unit}`} title={copy.example[unit]} />
				) : (
					measures.map((measure, index) => (
						<InsetRow
							key={measure.id}
							id={measure.id}
							title={measure.name}
							value={`${formatQuantity(measure.amount, locale)} ${unit}`}
							onPress={disabled ? undefined : () => onEdit(measure)}
							actions={actions(measure, index)}
						/>
					))
				)}
			</InsetList>
		</View>
	);
}
