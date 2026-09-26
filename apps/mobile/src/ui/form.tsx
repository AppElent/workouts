import { HeaderHeightContext } from "expo-router/react-navigation";
import { Children, type ReactNode, type Ref, useContext } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	type TextInputProps,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { PrimaryButton } from "./button";
import { Segmented, type SegmentedOption } from "./segmented";
import { AppText } from "./text";

type PrimaryAction = {
	label: string;
	accessibilityLabel?: string;
	onPress: () => void;
	loading?: boolean;
	disabled?: boolean;
};

/**
 * Owns the mechanics every long mobile form otherwise reimplements: keyboard
 * avoidance, safe-area footer, one scrolling content column and one primary
 * action. Route-backed screens leave `title` undefined and use the navigator.
 */
export function FormScreen({
	children,
	title,
	showHeader = title !== undefined,
	cancelLabel = "Cancel",
	onCancel,
	primaryAction,
	primaryActionPlacement = "fixed",
	contentStyle,
	scrollRef,
}: {
	children: ReactNode;
	title?: string;
	showHeader?: boolean;
	cancelLabel?: string;
	onCancel?: () => void;
	primaryAction?: PrimaryAction;
	primaryActionPlacement?: "fixed" | "header";
	contentStyle?: ViewStyle;
	scrollRef?: Ref<ScrollView>;
}) {
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const headerHeight = useContext(HeaderHeightContext) ?? 0;

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			// Native stack content starts below its header. A modal with its own
			// title starts at the window origin, regardless of the parent's header.
			keyboardVerticalOffset={showHeader ? 0 : headerHeight}
			style={styles.screen}
		>
			{showHeader ? (
				<View style={styles.modalHeader}>
					{onCancel ? (
						<Pressable
							onPress={onCancel}
							accessibilityRole="button"
							style={styles.headerAction}
						>
							<AppText style={styles.headerActionText}>{cancelLabel}</AppText>
						</Pressable>
					) : (
						<View style={styles.headerAction} />
					)}
					{title ? (
						<AppText
							variant="heading"
							numberOfLines={2}
							style={styles.modalTitle}
						>
							{title}
						</AppText>
					) : (
						<View style={styles.modalTitle} />
					)}
					{primaryAction && primaryActionPlacement === "header" ? (
						<Pressable
							onPress={primaryAction.onPress}
							disabled={primaryAction.disabled || primaryAction.loading}
							accessibilityRole="button"
							accessibilityLabel={primaryAction.accessibilityLabel}
							accessibilityState={{
								disabled: primaryAction.disabled || primaryAction.loading,
								busy: primaryAction.loading,
							}}
							style={[styles.headerAction, styles.headerActionTrailing]}
						>
							<AppText style={styles.headerActionText}>
								{primaryAction.label}
							</AppText>
						</Pressable>
					) : (
						<View style={styles.headerAction} />
					)}
				</View>
			) : null}
			<ScrollView
				ref={scrollRef}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="interactive"
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={[styles.content, contentStyle]}
			>
				{children}
			</ScrollView>
			{primaryAction && primaryActionPlacement === "fixed" ? (
				<View
					style={[
						styles.footer,
						{ paddingBottom: Math.max(insets.bottom, spacing.sm) },
					]}
				>
					<PrimaryButton
						label={primaryAction.label}
						accessibilityLabel={primaryAction.accessibilityLabel}
						onPress={primaryAction.onPress}
						loading={primaryAction.loading}
						disabled={primaryAction.disabled}
					/>
				</View>
			) : null}
		</KeyboardAvoidingView>
	);
}

/** A grouped mobile section with a title outside and row separators inside. */
export function FormSection({
	title,
	footer,
	children,
	style,
}: {
	title?: string;
	footer?: string;
	children: ReactNode;
	style?: ViewStyle;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={[styles.section, style]}>
			{title ? <AppText variant="label">{title}</AppText> : null}
			<View style={styles.group}>
				{Children.map(children, (row, index) => (
					<>
						{index > 0 ? <View style={styles.separator} /> : null}
						{row}
					</>
				))}
			</View>
			{footer ? <AppText variant="caption">{footer}</AppText> : null}
		</View>
	);
}

/** A grouped surface for composed content that should not receive row dividers. */
export function GroupedSurface({
	children,
	style,
}: {
	children: ReactNode;
	style?: ViewStyle;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={[styles.group, styles.surfacePadding, style]}>{children}</View>
	);
}

export function FormTextField({
	label,
	error,
	style,
	...props
}: TextInputProps & {
	label: string;
	error?: string;
	style?: TextInputProps["style"];
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.fieldRow}>
			<AppText variant="label">{label}</AppText>
			<TextInput
				{...props}
				accessibilityLabel={props.accessibilityLabel ?? label}
				placeholderTextColor={props.placeholderTextColor ?? colors.textFaint}
				style={[styles.textInput, style]}
			/>
			{error ? (
				<AppText selectable accessibilityRole="alert" style={styles.error}>
					{error}
				</AppText>
			) : null}
		</View>
	);
}

/** A mutually exclusive choice set presented as one grouped form row. */
export function FormSegmentedRow<Value extends string>({
	options,
	value,
	onChange,
}: {
	options: readonly SegmentedOption<Value>[];
	value: Value;
	onChange: (next: Value) => void;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.segmentedRow}>
			<Segmented options={options} value={value} onChange={onChange} />
		</View>
	);
}

export function InlineNumberFieldRow({
	label,
	suffix,
	accessory,
	inputStyle,
	inputRef,
	...props
}: TextInputProps & {
	label: string;
	suffix: string;
	accessory?: ReactNode;
	inputStyle?: TextInputProps["style"];
	inputRef?: Ref<TextInput>;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.inlineRow}>
			<AppText style={styles.rowLabel}>{label}</AppText>
			<View style={styles.inlineControls}>
				<TextInput
					ref={inputRef}
					{...props}
					accessibilityLabel={props.accessibilityLabel ?? label}
					placeholderTextColor={props.placeholderTextColor ?? colors.textFaint}
					style={[styles.numberInput, inputStyle]}
				/>
				<AppText variant="caption" style={styles.suffix}>
					{suffix}
				</AppText>
				{accessory}
			</View>
		</View>
	);
}

export function DisclosureRow({
	label,
	value,
	expanded,
	accessibilityLabel,
	onPress,
}: {
	label: string;
	value?: string;
	expanded?: boolean;
	accessibilityLabel?: string;
	onPress: () => void;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityState={expanded === undefined ? undefined : { expanded }}
			style={({ pressed }) => [styles.actionRow, pressed && styles.pressedRow]}
		>
			<AppText style={styles.rowLabel}>{label}</AppText>
			{value ? <AppText variant="caption">{value}</AppText> : null}
			<AppText style={styles.disclosureGlyph}>
				{expanded === undefined ? "›" : expanded ? "−" : "+"}
			</AppText>
		</Pressable>
	);
}

export function AddRow({
	label,
	onPress,
}: {
	label: string;
	onPress: () => void;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			style={({ pressed }) => [styles.actionRow, pressed && styles.pressedRow]}
		>
			<AppText style={styles.addGlyph}>＋</AppText>
			<AppText style={styles.actionLabel}>{label}</AppText>
		</Pressable>
	);
}

export function EditableValueRow({
	label,
	value,
	deleteLabel,
	deleteAccessibilityLabel,
	onPress,
	onDelete,
	disabled,
}: {
	label: string;
	value: string;
	deleteLabel?: string;
	deleteAccessibilityLabel?: string;
	onPress: () => void;
	onDelete?: () => void;
	disabled?: boolean;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.editableRow}>
			<Pressable
				onPress={onPress}
				disabled={disabled}
				accessibilityRole="button"
				accessibilityState={{ disabled }}
				style={({ pressed }) => [
					styles.editableMain,
					pressed && styles.pressedRow,
					disabled && styles.disabled,
				]}
			>
				<View style={styles.editableCopy}>
					<AppText style={styles.rowLabel}>{label}</AppText>
					<AppText variant="caption">{value}</AppText>
				</View>
				<AppText style={styles.chevron}>›</AppText>
			</Pressable>
			{onDelete && deleteLabel ? (
				<Pressable
					onPress={onDelete}
					disabled={disabled}
					accessibilityRole="button"
					accessibilityState={{ disabled }}
					accessibilityLabel={deleteAccessibilityLabel ?? deleteLabel}
					style={({ pressed }) => [
						styles.deleteAction,
						pressed && styles.pressedRow,
					]}
				>
					<AppText variant="caption" style={styles.deleteText}>
						{deleteLabel}
					</AppText>
				</Pressable>
			) : null}
		</View>
	);
}

export function InlineActionRow({ children }: { children: ReactNode }) {
	const styles = useThemedStyles(createStyles);
	return <View style={styles.inlineActions}>{children}</View>;
}

export function FormPreview({ children }: { children: ReactNode }) {
	const styles = useThemedStyles(createStyles);
	return <View style={styles.preview}>{children}</View>;
}

export function FormChoiceChips<const Id extends string>({
	options,
	selectedId,
	onSelect,
}: {
	options: readonly { id: Id; label: string }[];
	selectedId?: Id;
	onSelect: (id: Id) => void;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.choiceChips} accessibilityRole="radiogroup">
			{options.map((option) => (
				<Pressable
					key={option.id}
					onPress={() => onSelect(option.id)}
					accessibilityRole="radio"
					accessibilityState={{ checked: selectedId === option.id }}
					style={[
						styles.choiceChip,
						selectedId === option.id && styles.choiceChipSelected,
					]}
				>
					<AppText>{option.label}</AppText>
				</Pressable>
			))}
		</View>
	);
}

export function TextAction({
	label,
	tone = "accent",
	onPress,
	disabled,
}: {
	label: string;
	tone?: "accent" | "destructive" | "neutral";
	onPress: () => void;
	disabled?: boolean;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const color =
		tone === "destructive"
			? colors.danger
			: tone === "neutral"
				? colors.text
				: colors.accent;
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			style={({ pressed }) => [
				styles.textAction,
				pressed && styles.pressedRow,
				disabled && styles.disabled,
			]}
		>
			<AppText style={[styles.textActionLabel, { color }]}>{label}</AppText>
		</Pressable>
	);
}

export function StepperField({
	label,
	value,
	step = 1,
	min = 0,
	onChange,
}: {
	label: string;
	value: number;
	step?: number;
	min?: number;
	onChange: (value: number) => void;
}) {
	const styles = useThemedStyles(createStyles);
	const round = (number: number) => Math.round(number * 10) / 10;
	return (
		<View style={styles.stepperField}>
			<Pressable
				onPress={() => onChange(round(Math.max(min, value - step)))}
				accessibilityRole="button"
				accessibilityLabel={`Decrease ${label}`}
				style={styles.stepperButton}
			>
				<AppText style={styles.stepperGlyph}>−</AppText>
			</Pressable>
			<View style={styles.stepperValue}>
				<AppText style={styles.tabularValue}>{value}</AppText>
				<AppText variant="caption">{label}</AppText>
			</View>
			<Pressable
				onPress={() => onChange(round(value + step))}
				accessibilityRole="button"
				accessibilityLabel={`Increase ${label}`}
				style={styles.stepperButton}
			>
				<AppText style={styles.stepperGlyph}>＋</AppText>
			</Pressable>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		screen: { flex: 1, backgroundColor: colors.bg },
		content: {
			alignSelf: "center",
			width: "100%",
			maxWidth: 640,
			paddingHorizontal: metrics.screenGutter,
			paddingTop: spacing.sm,
			paddingBottom: spacing.xl,
			gap: metrics.sectionGap,
		},
		modalHeader: {
			minHeight: 52,
			paddingHorizontal: spacing.sm,
			flexDirection: "row",
			alignItems: "center",
		},
		headerAction: {
			minWidth: 76,
			minHeight: metrics.hitTarget,
			paddingHorizontal: spacing.sm,
			alignItems: "flex-start",
			justifyContent: "center",
		},
		headerActionText: { color: colors.accent, fontWeight: "700" },
		headerActionTrailing: { alignItems: "flex-end" },
		modalTitle: { flex: 1, textAlign: "center" },
		footer: {
			paddingTop: spacing.sm,
			paddingHorizontal: metrics.screenGutter,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.border,
			backgroundColor: colors.bg,
		},
		section: { gap: spacing.sm },
		group: {
			backgroundColor: colors.surface,
			borderRadius: radius.lg,
			borderCurve: "continuous",
			overflow: "hidden",
		},
		surfacePadding: { padding: spacing.md },
		separator: {
			height: StyleSheet.hairlineWidth,
			marginLeft: spacing.md,
			backgroundColor: colors.borderStrong,
		},
		fieldRow: { padding: spacing.md, gap: spacing.sm },
		segmentedRow: { padding: spacing.md },
		textInput: {
			minHeight: metrics.fieldMinHeight,
			borderRadius: radius.md,
			borderCurve: "continuous",
			backgroundColor: colors.surface2,
			paddingHorizontal: spacing.md,
			color: colors.text,
			fontSize: 15,
		},
		error: { color: colors.danger },
		inlineRow: {
			minHeight: metrics.rowMinHeight,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.xs,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		rowLabel: { flex: 1, minWidth: 0 },
		inlineControls: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			flexShrink: 0,
		},
		numberInput: {
			width: 82,
			minHeight: metrics.hitTarget,
			borderRadius: radius.md,
			borderCurve: "continuous",
			backgroundColor: colors.surface2,
			paddingHorizontal: spacing.sm,
			color: colors.text,
			fontSize: 15,
			fontVariant: ["tabular-nums"],
			textAlign: "right",
		},
		suffix: { width: 30 },
		actionRow: {
			minHeight: metrics.rowMinHeight,
			paddingHorizontal: spacing.md,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		pressedRow: { backgroundColor: colors.surface2 },
		disclosureGlyph: {
			minWidth: 20,
			textAlign: "center",
			color: colors.accent,
			fontSize: 22,
			fontWeight: "700",
		},
		addGlyph: { color: colors.accent, fontSize: 20, fontWeight: "700" },
		actionLabel: { flex: 1, color: colors.accent, fontWeight: "700" },
		editableRow: { flexDirection: "row", alignItems: "stretch" },
		editableMain: {
			flex: 1,
			minHeight: 60,
			paddingLeft: spacing.md,
			paddingVertical: spacing.sm,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		editableCopy: { flex: 1, minWidth: 0, gap: 2 },
		chevron: { color: colors.textFaint, fontSize: 24 },
		deleteAction: {
			minWidth: 72,
			paddingHorizontal: spacing.sm,
			alignItems: "center",
			justifyContent: "center",
		},
		deleteText: { color: colors.danger, fontWeight: "700" },
		inlineActions: {
			padding: spacing.sm,
			flexDirection: "row",
			justifyContent: "flex-end",
			alignItems: "center",
			gap: spacing.sm,
		},
		preview: { gap: spacing.sm, padding: spacing.md },
		choiceChips: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: spacing.sm,
			padding: spacing.md,
		},
		choiceChip: {
			minHeight: metrics.hitTarget,
			justifyContent: "center",
			paddingHorizontal: spacing.md,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			borderRadius: radius.pill,
		},
		choiceChipSelected: {
			borderColor: colors.accent,
			backgroundColor: colors.accentDim,
		},
		textAction: {
			minHeight: metrics.hitTarget,
			paddingHorizontal: spacing.md,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.md,
			borderCurve: "continuous",
		},
		textActionLabel: { fontWeight: "700" },
		disabled: { opacity: 0.5 },
		stepperField: {
			flex: 1,
			minWidth: 96,
			height: 48,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			borderRadius: radius.md,
			borderCurve: "continuous",
			backgroundColor: colors.surface2,
		},
		stepperButton: {
			width: 36,
			height: metrics.hitTarget,
			alignItems: "center",
			justifyContent: "center",
		},
		stepperGlyph: { color: colors.textMuted, fontSize: 18, fontWeight: "800" },
		stepperValue: { alignItems: "center" },
		tabularValue: { fontWeight: "800", fontVariant: ["tabular-nums"] },
	});
