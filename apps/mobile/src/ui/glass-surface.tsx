import type { ReactNode } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { radius, useTokens } from "../theme";
export type GlassSurfaceProps = {
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
	capsule?: boolean;
	tint?: string;
};
export function GlassSurface({
	children,
	style,
	capsule,
	tint,
}: GlassSurfaceProps) {
	const colors = useTokens();
	return (
		<View
			style={[
				{
					backgroundColor: tint ?? colors.surface2,
					borderRadius: capsule ? radius.pill : radius.sheet,
					borderCurve: "continuous",
				},
				style,
			]}
		>
			{children}
		</View>
	);
}
