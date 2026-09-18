import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { type ComponentProps, useState } from "react";
import { StyleSheet, View } from "react-native";
import type {
	FoodVisual,
	FoodVisualPresetId,
} from "../data/personal-food-repository";
import { colors, radius } from "../theme";

const PRESET_SYMBOLS = {
	fruit: { ios: "carrot.fill", android: "nutrition", web: "nutrition" },
	vegetable: { ios: "leaf.fill", android: "eco", web: "eco" },
	grains: {
		ios: "basket.fill",
		android: "bakery_dining",
		web: "bakery_dining",
	},
	dairy: {
		ios: "cup.and.saucer.fill",
		android: "local_drink",
		web: "local_drink",
	},
	egg: { ios: "oval.portrait.fill", android: "egg", web: "egg" },
	meat: { ios: "fork.knife", android: "kebab_dining", web: "kebab_dining" },
	fish: { ios: "fish.fill", android: "set_meal", web: "set_meal" },
	meal: {
		ios: "fork.knife.circle.fill",
		android: "restaurant",
		web: "restaurant",
	},
	snack: { ios: "birthday.cake.fill", android: "cake", web: "cake" },
	drink: { ios: "waterbottle.fill", android: "local_cafe", web: "local_cafe" },
	supplement: { ios: "pills.fill", android: "medication", web: "medication" },
	condiment: {
		ios: "takeoutbag.and.cup.and.straw.fill",
		android: "fastfood",
		web: "fastfood",
	},
} as const satisfies Readonly<
	Record<FoodVisualPresetId, ComponentProps<typeof SymbolView>["name"]>
>;

const FALLBACK_SYMBOL = {
	ios: "fork.knife.circle",
	android: "restaurant",
	web: "restaurant",
} as const satisfies ComponentProps<typeof SymbolView>["name"];

export function FoodVisualView({
	visual,
	label,
	accessibilityLabel = `${label} visual`,
	size = 52,
}: {
	visual?: FoodVisual;
	label: string;
	accessibilityLabel?: string;
	size?: number;
}) {
	if (visual?.kind === "photo") {
		return (
			<FoodPhoto
				key={visual.uri}
				uri={visual.uri}
				label={label}
				accessibilityLabel={accessibilityLabel}
				size={size}
			/>
		);
	}

	return (
		<View
			accessible
			accessibilityLabel={accessibilityLabel}
			style={[styles.symbol, { width: size, height: size }]}
		>
			<SymbolView
				name={
					visual?.kind === "icon"
						? PRESET_SYMBOLS[visual.preset]
						: FALLBACK_SYMBOL
				}
				size={Math.round(size * 0.48)}
				tintColor={visual?.kind === "icon" ? colors.accent : colors.textMuted}
			/>
		</View>
	);
}

function FoodPhoto({
	uri,
	label,
	accessibilityLabel,
	size,
}: {
	uri: string;
	label: string;
	accessibilityLabel: string;
	size: number;
}) {
	const [failed, setFailed] = useState(false);
	if (failed) {
		return (
			<FoodVisualView
				label={label}
				accessibilityLabel={accessibilityLabel}
				size={size}
			/>
		);
	}
	return (
		<Image
			source={uri}
			accessibilityLabel={accessibilityLabel}
			contentFit="cover"
			onError={() => setFailed(true)}
			style={[styles.image, { width: size, height: size }]}
		/>
	);
}

const styles = StyleSheet.create({
	image: { borderRadius: radius.sm, backgroundColor: colors.surface2 },
	symbol: {
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.sm,
		backgroundColor: colors.surface2,
	},
});
