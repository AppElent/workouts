import { SymbolView } from "expo-symbols";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";
export function DiarySelectionActions({
	labels,
	disabled,
	onCopy,
	onMove,
	onCombo,
	onDelete,
}: {
	labels: { copy: string; move: string; combo: string; delete: string };
	disabled: boolean;
	onCopy: () => void;
	onMove: () => void;
	onCombo: () => void;
	onDelete: () => void;
}) {
	const colors = useTokens();
	const { width } = useWindowDimensions();
	const actions = [
		{ label: labels.copy, icon: "doc.on.doc" as const, onPress: onCopy },
		{ label: labels.move, icon: "arrow.right" as const, onPress: onMove },
		{ label: labels.combo, icon: "square.grid.2x2" as const, onPress: onCombo },
		{ label: labels.delete, icon: "trash" as const, onPress: onDelete },
	];
	return (
		<View
			style={{
				width: Math.min(width - 40, 600),
				flexDirection: "row",
				paddingVertical: 8,
			}}
		>
			{actions.map((a, i) => (
				<Pressable
					key={a.icon}
					accessibilityRole="button"
					accessibilityLabel={a.label}
					accessibilityState={{ disabled }}
					disabled={disabled}
					onPress={a.onPress}
					style={{
						flex: 1,
						minHeight: 48,
						alignItems: "center",
						justifyContent: "center",
						gap: 4,
						opacity: disabled ? 0.4 : 1,
					}}
				>
					<SymbolView
						name={a.icon}
						size={19}
						tintColor={i === 3 ? colors.danger : colors.text}
					/>
					<AppText
						variant="caption"
						style={{
							color: i === 3 ? colors.danger : colors.text,
							textAlign: "center",
						}}
					>
						{a.label}
					</AppText>
				</Pressable>
			))}
		</View>
	);
}
