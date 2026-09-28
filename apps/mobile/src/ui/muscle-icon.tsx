import { Image } from "expo-image";
import type { Group } from "../screens/exercise-library/model";

const sources = {
	chest: require("../../../../public/muscle-icons/chest.png"),
	back: require("../../../../public/muscle-icons/back.png"),
	legs: require("../../../../public/muscle-icons/quadriceps.png"),
	shoulders: require("../../../../public/muscle-icons/shoulders.png"),
	arms: require("../../../../public/muscle-icons/arms.png"),
	core: require("../../../../public/muscle-icons/abs.png"),
	other: require("../../../../public/muscle-icons/full-body.png"),
};
/** Decorative: the neighboring text names the muscle group. */
export function MuscleIcon({
	group,
	size = 48,
}: {
	group: Group | "other";
	size?: number;
}) {
	return (
		<Image
			source={sources[group]}
			contentFit="contain"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			style={{ width: size, height: size }}
		/>
	);
}
