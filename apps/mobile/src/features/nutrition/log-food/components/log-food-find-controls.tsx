import { SymbolView } from "expo-symbols";
import type { Ref } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import {
	radius,
	spacing,
	type Tokens,
	type,
	useThemedStyles,
	useTokens,
} from "../../../../theme";
import { LogFoodIconButton } from "./log-food-icon-button";
import { LogFoodMenu } from "./log-food-menu";
import type { LogFoodMenuProps } from "./log-food-menu-props";

/**
 * The in-content search row for Android and iOS before 26: search, scan,
 * describe, and the + menu — the same actions the iOS 26 bottom toolbar has.
 */
export function LogFoodFindControls({
	inputRef,
	query,
	placeholder,
	scanLabel,
	describeLabel,
	menu,
	onChangeQuery,
	onSubmit,
	onScan,
	onDescribe,
}: {
	inputRef?: Ref<TextInput>;
	query: string;
	placeholder: string;
	scanLabel: string;
	describeLabel: string;
	menu: LogFoodMenuProps;
	onChangeQuery: (query: string) => void;
	onSubmit: () => void;
	onScan: () => void;
	onDescribe: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.row}>
			<View style={styles.field}>
				<SymbolView
					name={{ ios: "magnifyingglass", android: "search", web: "search" }}
					size={16}
					tintColor={colors.textFaint}
				/>
				<TextInput
					ref={inputRef}
					value={query}
					onChangeText={onChangeQuery}
					onSubmitEditing={onSubmit}
					returnKeyType="search"
					placeholder={placeholder}
					placeholderTextColor={colors.textFaint}
					accessibilityLabel={placeholder}
					style={styles.input}
					autoCorrect={false}
				/>
			</View>
			<LogFoodIconButton
				label={scanLabel}
				symbol={{
					ios: "barcode.viewfinder",
					android: "barcode_scanner",
					web: "barcode",
				}}
				onPress={onScan}
			/>
			<LogFoodIconButton
				label={describeLabel}
				symbol={{
					ios: "sparkles",
					android: "auto_awesome",
					web: "auto_awesome",
				}}
				accented
				onPress={onDescribe}
			/>
			<LogFoodMenu {...menu} />
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			paddingHorizontal: spacing.md,
		},
		field: {
			flex: 1,
			minWidth: 0,
			minHeight: 44,
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
			paddingHorizontal: 10,
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
		input: {
			flex: 1,
			minWidth: 0,
			minHeight: 44,
			color: colors.text,
			fontSize: type.secondary.fontSize,
		},
	});
