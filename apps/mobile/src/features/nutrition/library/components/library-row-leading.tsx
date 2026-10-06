import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useTokens } from "../../../../theme";

/** In selection mode the row leads with a checkmark circle before its tile. */
export function LibraryRowLeading({
	selected,
	children,
}: {
	selected?: boolean;
	children: ReactNode;
}) {
	const colors = useTokens();
	if (selected === undefined) return <>{children}</>;
	return (
		<View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
			<View
				style={{
					width: 24,
					height: 24,
					borderRadius: 12,
					borderWidth: selected ? 0 : 1.5,
					borderColor: colors.textFaint,
					backgroundColor: selected ? colors.accentFill : undefined,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				{selected ? (
					<SymbolView
						name={{ ios: "checkmark", android: "check", web: "check" }}
						size={13}
						weight="bold"
						tintColor={colors.onAccent}
					/>
				) : null}
			</View>
			{children}
		</View>
	);
}
