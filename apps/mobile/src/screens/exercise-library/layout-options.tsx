import { Pressable, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useI18n } from "../../i18n";
import { useTokens } from "../../theme";
import { AppText } from "../../ui/text";
import type { Layout } from "./model";
export type LayoutMenuProps = {
	value: Layout;
	onChange: (value: Layout) => void;
};
export function LayoutOptions({ value, onChange }: LayoutMenuProps) {
	const colors = useTokens();
	const { t } = useI18n();
	const copy = t.exercises;
	return (
		<View style={{ width: 300, padding: 16, gap: 12 }}>
			<AppText variant="footnote" style={{ color: colors.textMuted }}>
				{copy.layout}
			</AppText>
			<View style={{ flexDirection: "row", gap: 12 }}>
				{(["list", "groups"] as const).map((layout) => {
					const selected = value === layout;
					const ink = selected ? colors.accent : colors.textFaint;
					return (
						<Pressable
							key={layout}
							accessibilityRole="radio"
							accessibilityState={{ selected }}
							accessibilityLabel={layout === "list" ? copy.list : copy.grouped}
							onPress={() => onChange(layout)}
							style={{
								flex: 1,
								alignItems: "center",
								paddingVertical: 8,
								gap: 12,
								borderRadius: 14,
								backgroundColor: selected ? colors.accentDim : undefined,
							}}
						>
							<Svg
								width={62}
								height={110}
								viewBox="0 0 62 110"
								accessible={false}
							>
								<Rect
									x={3}
									y={2}
									width={56}
									height={106}
									rx={11}
									stroke={ink}
									strokeWidth={2.5}
									fill="none"
								/>
								<Rect x={23} y={7} width={16} height={4} rx={2} fill={ink} />
								{(layout === "list"
									? [25, 39, 53, 67, 81]
									: [28, 42, 72, 86]
								).map((y) => (
									<Rect
										key={y}
										x={10}
										y={y}
										width={42}
										height={10}
										rx={3}
										fill={ink}
										opacity={0.35}
									/>
								))}
								{layout === "groups"
									? [21, 65].map((y) => (
											<Rect
												key={y}
												x={10}
												y={y}
												width={22}
												height={3}
												rx={1.5}
												fill={ink}
											/>
										))
									: null}
							</Svg>
							<AppText variant="secondary" style={{ textAlign: "center" }}>
								{layout === "list" ? copy.list : copy.grouped}
							</AppText>
							<View
								style={{
									width: 26,
									height: 26,
									borderRadius: 13,
									borderWidth: selected ? 0 : 1.5,
									borderColor: ink,
									backgroundColor: selected ? colors.accentFill : undefined,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								{selected ? (
									<AppText variant="label" style={{ color: colors.onAccent }}>
										✓
									</AppText>
								) : null}
							</View>
						</Pressable>
					);
				})}
			</View>
			<AppText variant="footnote" style={{ color: colors.textMuted }}>
				{copy.layoutHelp}
			</AppText>
		</View>
	);
}
