import { View } from "react-native";
import { spacing } from "../../../../theme";
import { AppText } from "../../../../ui/text";
import type { WeekDayStatus } from "../week-summary";
import { WeekStatusMark } from "./week-status-mark";

/** One row per goal: its weekly average, then one mark per day. */
export function WeekStatusGrid({
	weekdayInitials,
	rows,
}: {
	weekdayInitials: readonly string[];
	rows: readonly {
		key: string;
		label: string;
		average?: string;
		statuses: readonly WeekDayStatus[];
		accessibilityLabel: string;
	}[];
}) {
	const marks = { flexDirection: "row" as const, gap: 9 };
	return (
		<View style={{ gap: 9 }}>
			<View style={{ flexDirection: "row" }} accessibilityElementsHidden>
				<View style={{ flex: 1 }} />
				<View style={marks}>
					{weekdayInitials.map((initial, index) => (
						<AppText
							// biome-ignore lint/suspicious/noArrayIndexKey: weekday columns are positional.
							key={index}
							variant="caption"
							style={{ width: 14, textAlign: "center", fontWeight: "700" }}
						>
							{initial}
						</AppText>
					))}
				</View>
			</View>
			{rows.map((row) => (
				<View
					key={row.key}
					accessible
					accessibilityLabel={row.accessibilityLabel}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing.sm,
					}}
				>
					<AppText variant="footnote" style={{ flex: 1 }} numberOfLines={1}>
						<AppText variant="footnote" style={{ fontWeight: "600" }}>
							{row.label}
						</AppText>
						{row.average ? ` ${row.average}` : ""}
					</AppText>
					<View style={marks}>
						{row.statuses.map((status, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: one mark per weekday.
							<WeekStatusMark key={index} status={status} />
						))}
					</View>
				</View>
			))}
		</View>
	);
}
