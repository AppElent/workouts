import { SymbolView } from "expo-symbols";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";

/** Bottom toolbar in selection mode: Make combo · Favourite · Duplicate · Delete. */
export function LibrarySelectionActions({
	actions,
}: {
	actions: readonly {
		key: string;
		label: string;
		icon: "square.stack.3d.up" | "star" | "plus.square.on.square" | "trash";
		disabled: boolean;
		destructive?: boolean;
		onPress: () => void;
	}[];
}) {
	const colors = useTokens();
	const { width } = useWindowDimensions();
	return (
		<View
			style={{
				width: Math.min(width - 40, 600),
				flexDirection: "row",
				paddingVertical: 8,
			}}
		>
			{actions.map((action) => {
				const tint = action.destructive ? colors.danger : colors.text;
				return (
					<Pressable
						key={action.key}
						accessibilityRole="button"
						accessibilityLabel={action.label}
						accessibilityState={{ disabled: action.disabled }}
						disabled={action.disabled}
						onPress={action.onPress}
						style={{
							flex: 1,
							minHeight: 48,
							alignItems: "center",
							justifyContent: "center",
							gap: 4,
							opacity: action.disabled ? 0.4 : 1,
						}}
					>
						<SymbolView name={action.icon} size={19} tintColor={tint} />
						<AppText
							variant="caption"
							style={{ color: tint, textAlign: "center" }}
						>
							{action.label}
						</AppText>
					</Pressable>
				);
			})}
		</View>
	);
}
