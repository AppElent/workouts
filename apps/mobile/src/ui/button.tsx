/**
 * Two buttons, because V1 needs two: the accent-filled primary action and a
 * quiet bordered one. Both are capsules — the web's `--r-pill` on its primary
 * CTA, and the shape a thumb finds without looking.
 *
 * `Pressable`'s `pressed` state carries the feedback rather than an opacity
 * animation: on a phone held at arm's length mid-set, a colour change reads
 * and a fade does not.
 */
import { Pressable, type PressableProps, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { AppText } from "./text";

type Props = Omit<PressableProps, "children"> & {
	label: string;
	/** Rendered to the left of the label — an icon, usually. */
	icon?: React.ReactNode;
	size?: "md" | "lg";
};

export function PrimaryButton({
	label,
	icon,
	size = "md",
	style,
	...rest
}: Props) {
	return (
		<Pressable
			{...rest}
			style={(state) => [
				styles.base,
				size === "lg" && styles.lg,
				{
					backgroundColor: state.pressed ? colors.accentPressed : colors.accent,
				},
				typeof style === "function" ? style(state) : style,
			]}
		>
			{icon ? <View style={styles.icon}>{icon}</View> : null}
			<AppText
				variant={size === "lg" ? "heading" : "body"}
				style={{ color: colors.onAccent, fontWeight: "800" }}
			>
				{label}
			</AppText>
		</Pressable>
	);
}

export function GhostButton({
	label,
	icon,
	size = "md",
	style,
	...rest
}: Props) {
	return (
		<Pressable
			{...rest}
			style={(state) => [
				styles.base,
				size === "lg" && styles.lg,
				styles.ghost,
				state.pressed && { backgroundColor: colors.surface2 },
				typeof style === "function" ? style(state) : style,
			]}
		>
			{icon ? <View style={styles.icon}>{icon}</View> : null}
			<AppText variant={size === "lg" ? "heading" : "body"}>{label}</AppText>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	base: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.sm,
		borderRadius: radius.pill,
		paddingVertical: 14,
		paddingHorizontal: spacing.lg,
	},
	lg: {
		paddingVertical: 20,
		paddingHorizontal: spacing.xl,
	},
	ghost: {
		backgroundColor: "transparent",
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	icon: {
		alignItems: "center",
		justifyContent: "center",
	},
});
