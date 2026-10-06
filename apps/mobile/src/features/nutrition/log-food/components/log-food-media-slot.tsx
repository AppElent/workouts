import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import {
	type Tokens,
	type,
	useThemedStyles,
	useTokens,
} from "../../../../theme";
import { AppText } from "../../../../ui/text";

/**
 * Every row leads with a tile this wide, drawn whether or not the food has a
 * picture, so titles line up at one indent (design `.fv`).
 */
export const MEDIA_SLOT = 38;

/** The tile a row leads with: a remote photo, an emoji, or a symbol. */
export function LogFoodMediaSlot({
	symbol,
	emoji,
	imageUrl,
	label,
}: {
	symbol: ComponentProps<typeof SymbolView>["name"];
	emoji?: string;
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
			{emoji ? (
				<AppText style={styles.emoji} importantForAccessibility="no">
					{emoji}
				</AppText>
			) : (
				<SymbolView name={symbol} size={18} tintColor={colors.textMuted} />
			)}
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
			borderRadius: 11,
			borderCurve: "continuous",
			backgroundColor: colors.surface2,
		},
		centered: { alignItems: "center", justifyContent: "center" },
		emoji: { fontSize: type.navTitle.fontSize, lineHeight: 22 },
	});
