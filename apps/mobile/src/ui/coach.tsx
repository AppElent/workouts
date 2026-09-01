/**
 * The pieces every screen reaches for: a card, a chip, a stat box, an eyebrow,
 * and the coloured tile that stands in for an activity type's icon.
 *
 * Deliberately small. `button.tsx`, `screen.tsx` and `text.tsx` are the load-
 * bearing primitives; these are the recurring compositions on top of them, kept
 * here only so seven screens don't each grow their own card.
 */
import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors, type SportKey, sportMeta } from "../theme";
import { AppText } from "./text";

export function Card({
	children,
	style,
}: {
	children: ReactNode;
	style?: ViewStyle;
}) {
	return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({
	label,
	active,
	color,
}: {
	label: string;
	active?: boolean;
	color?: string;
}) {
	return (
		<View
			style={[
				styles.chip,
				active
					? { backgroundColor: colors.accent }
					: { backgroundColor: colors.surface2 },
			]}
		>
			<AppText
				style={{
					fontSize: 12,
					fontWeight: "700",
					color: active ? colors.onAccent : (color ?? colors.textMuted),
				}}
			>
				{label}
			</AppText>
		</View>
	);
}

export function SportIcon({
	sport,
	size = 34,
}: {
	sport: SportKey;
	size?: number;
}) {
	const meta = sportMeta[sport];
	return (
		<View
			style={[
				styles.sportIcon,
				{
					width: size,
					height: size,
					borderRadius: size * 0.32,
					backgroundColor: meta.dim,
				},
			]}
		>
			<AppText
				style={{ color: meta.color, fontWeight: "800", fontSize: size * 0.4 }}
			>
				{meta.glyph}
			</AppText>
		</View>
	);
}

export function StatBox({
	value,
	unit,
	label,
	color,
}: {
	value: string;
	unit?: string;
	label: string;
	color?: string;
}) {
	return (
		<View style={styles.statBox}>
			<AppText
				style={{
					fontSize: 21,
					fontWeight: "800",
					color: color ?? colors.text,
				}}
			>
				{value}
				{unit ? (
					<AppText
						style={{
							fontSize: 12,
							fontWeight: "700",
							color: colors.textMuted,
						}}
					>
						{" "}
						{unit}
					</AppText>
				) : null}
			</AppText>
			<AppText
				style={{
					fontSize: 10,
					fontWeight: "800",
					letterSpacing: 0.6,
					textTransform: "uppercase",
					color: colors.textMuted,
				}}
			>
				{label}
			</AppText>
		</View>
	);
}

export function Eyebrow({ children }: { children: ReactNode }) {
	return (
		<AppText
			style={{
				fontSize: 11,
				fontWeight: "800",
				letterSpacing: 1,
				textTransform: "uppercase",
				color: colors.textMuted,
			}}
		>
			{children}
		</AppText>
	);
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: colors.surface,
		borderColor: colors.border,
		borderWidth: 1,
		borderRadius: 18,
		padding: 16,
	},
	chip: {
		height: 34,
		paddingHorizontal: 14,
		borderRadius: 9999,
		alignItems: "center",
		justifyContent: "center",
	},
	sportIcon: { alignItems: "center", justifyContent: "center" },
	statBox: {
		flex: 1,
		backgroundColor: colors.surface,
		borderRadius: 16,
		paddingVertical: 15,
		paddingHorizontal: 13,
		gap: 4,
	},
});
