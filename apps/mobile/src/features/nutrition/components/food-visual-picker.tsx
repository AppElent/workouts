import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { View } from "react-native";
import type {
	FoodPhotoCropPosition,
	FoodPhotoSource,
} from "../../../data/food-photo-manager";
import {
	FOOD_VISUAL_PRESET_IDS,
	type FoodVisualPresetId,
} from "../../../data/personal-food-repository";
import { useI18n } from "../../../i18n";
import { radius, useTokens } from "../../../theme";
import { FoodVisualView } from "../../../ui/food-visual";
import type { EditorVisual } from "../use-staged-food-visual";
import { foodEditorCopy } from "./food-editor-copy";
import { NutritionChoiceMenu } from "./nutrition-choice-menu";

const CROP_POSITIONS = ["center", "top", "bottom", "left", "right"] as const;

/**
 * A food's photo or icon as the hero of its form, and the one popup that
 * changes it (mobile-design "Photo popup"): Take photo, Choose photo, Icon ›
 * with the current one beside it, and Remove photo only when there is one.
 * An imported photo not yet saved also offers where to crop it.
 */
export function FoodVisualPicker({
	visual,
	name,
	size = 96,
	crop,
	onPhoto,
	onVisual,
	onCrop,
}: {
	visual?: EditorVisual;
	/** The food's name, for the default icon and the spoken label. */
	name: string;
	size?: number;
	crop?: FoodPhotoCropPosition;
	onPhoto: (source: FoodPhotoSource) => void;
	onVisual: (next: EditorVisual | undefined) => void;
	onCrop?: (position: FoodPhotoCropPosition) => void;
}) {
	const { locale } = useI18n();
	const copy = foodEditorCopy[locale];
	const colors = useTokens();
	const hasPhoto = visual?.kind === "photo" || visual?.kind === "remote";
	const preset = visual?.kind === "icon" ? visual.preset : undefined;
	return (
		<NutritionChoiceMenu
			accessibilityLabel={copy.visual}
			sections={[
				[
					{ id: "camera", label: copy.takePhoto, symbol: "camera" },
					{ id: "library", label: copy.choosePhoto, symbol: "photo" },
					{
						id: "icon",
						label: copy.icon,
						hint: hasPhoto
							? undefined
							: preset
								? copy.visualPresets[preset]
								: copy.defaultVisual,
						symbol: "tag",
						submenu: [
							{
								id: "default",
								label: copy.defaultVisual,
								selected: !hasPhoto && !preset,
							},
							...FOOD_VISUAL_PRESET_IDS.map((id) => ({
								id,
								label: copy.visualPresets[id],
								selected: preset === id,
							})),
						],
					},
				],
				...(hasPhoto
					? [[{ id: "remove", label: copy.removePhoto, destructive: true }]]
					: []),
				...(visual?.kind === "remote" && onCrop
					? [
							CROP_POSITIONS.map((position) => ({
								id: `crop:${position}`,
								label: copy.cropPositions[position],
								hint: copy.cropPosition,
								selected: crop === position,
							})),
						]
					: []),
			]}
			onSelect={(id) => {
				if (id === "camera" || id === "library") onPhoto(id);
				else if (id.startsWith("crop:"))
					onCrop?.(id.slice(5) as FoodPhotoCropPosition);
				else if (id === "remove" || id === "default") onVisual(undefined);
				else onVisual({ kind: "icon", preset: id as FoodVisualPresetId });
			}}
		>
			<View style={{ width: size, height: size }}>
				{visual?.kind === "remote" ? (
					<Image
						source={visual.uri}
						contentFit="cover"
						contentPosition={crop}
						style={{ width: size, height: size, borderRadius: radius.lg }}
					/>
				) : (
					<FoodVisualView visual={visual} label={name} size={size} />
				)}
				<View
					style={{
						position: "absolute",
						right: -4,
						bottom: -4,
						width: 28,
						height: 28,
						borderRadius: 14,
						backgroundColor: colors.surface,
						alignItems: "center",
						justifyContent: "center",
						boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
					}}
				>
					<SymbolView
						name={{
							ios: "camera",
							android: "photo_camera",
							web: "photo_camera",
						}}
						size={13}
						tintColor={colors.text}
					/>
				</View>
			</View>
		</NutritionChoiceMenu>
	);
}
