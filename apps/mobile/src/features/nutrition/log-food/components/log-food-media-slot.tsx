import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import {
	radius,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../../theme";

/**
 * Every row leads with a slot this wide, drawn whether or not the food has a
 * picture, so titles line up at one indent instead of three.
 */
export const MEDIA_SLOT = 44;

/** The 44pt slot a row leads with: a remote photo, or a symbol on a tile. */
export function LogFoodMediaSlot({
	symbol,
	imageUrl,
	label,
}: {
	symbol: ComponentProps<typeof SymbolView>["name"];
	imageUrl?: string;
	label?: string;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	if (imageUrl)
		return (
			<Image
				source={imageUrl}
				accessibilityLabel={label}
				cachePolicy="memory-disk"
				contentFit="contain"
				style={styles.slot}
			/>
		);
	return (
		<View style={[styles.slot, styles.centered]}>
			<SymbolView name={symbol} size={20} tintColor={colors.textFaint} />
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		slot: {
			width: MEDIA_SLOT,
			height: MEDIA_SLOT,
			flexGrow: 0,
			flexShrink: 0,
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
		centered: { alignItems: "center", justifyContent: "center" },
	});
