import { View } from "react-native";
import { useTokens } from "../../../../theme";
import type { WeekDayStatus } from "../week-summary";

/**
 * One day's status as a small mark. Shape and fill differ per status (filled,
 * outlined, dashed, dotted), so colour is never the only signal.
 */
export function WeekStatusMark({
	status,
	size = 14,
	round = false,
}: {
	status: WeekDayStatus;
	size?: number;
	round?: boolean;
}) {
	const colors = useTokens();
	const radius = round ? size / 2 : Math.max(3, size / 4);
	const base = {
		width: size,
		height: size,
		borderRadius: radius,
		alignItems: "center" as const,
		justifyContent: "center" as const,
	};
	switch (status) {
		case "ok":
			return <View style={[base, { backgroundColor: colors.accent }]} />;
		case "over":
			return <View style={[base, { backgroundColor: colors.danger }]} />;
		case "below":
			return (
				<View style={[base, { borderWidth: 1.5, borderColor: colors.warn }]} />
			);
		case "incomplete":
			return (
				<View
					style={[
						base,
						{
							borderWidth: 1.2,
							borderStyle: "dashed",
							borderColor: colors.textMuted,
						},
					]}
				/>
			);
		case "today":
			return (
				<View
					style={[base, { borderWidth: 1.2, borderColor: colors.textMuted }]}
				>
					<View
						style={{
							width: size / 4,
							height: size / 4,
							borderRadius: size / 8,
							backgroundColor: colors.textMuted,
						}}
					/>
				</View>
			);
		default:
			return <View style={[base, { backgroundColor: colors.surface2 }]} />;
	}
}
