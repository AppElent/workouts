import { Pressable, View } from "react-native";
import Svg, { Defs, Line, Pattern, Rect } from "react-native-svg";
import type { IsoDate } from "../../../../data/calendar-day";
import { radius, useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";
import type { WeekDayStatus } from "../week-summary";

export type WeekBar = {
	date: IsoDate;
	label: string;
	amount: number;
	status: WeekDayStatus;
	minimum?: number;
	maximum?: number;
	accessibilityLabel: string;
};

const HEIGHT = 92;

/**
 * One bar per day with that day's goal band behind it, so a goal change in the
 * middle of the week shows where it happens. Each bar opens its day.
 */
export function WeekBars({
	bars,
	today,
	onPressDay,
}: {
	bars: readonly WeekBar[];
	today: IsoDate;
	onPressDay: (date: IsoDate) => void;
}) {
	const colors = useTokens();
	const scale = Math.max(
		1,
		...bars.map((bar) =>
			Math.max(bar.amount, bar.maximum ?? 0, bar.minimum ?? 0),
		),
	);
	const y = (value: number) => HEIGHT - (value / scale) * (HEIGHT - 6);
	const fill = (status: WeekDayStatus) =>
		status === "ok"
			? colors.accent
			: status === "over"
				? colors.danger
				: status === "below"
					? colors.warn
					: colors.textFaint;
	return (
		<View style={{ flexDirection: "row", gap: 6 }}>
			{bars.map((bar) => {
				const height = bar.amount > 0 ? Math.max(4, HEIGHT - y(bar.amount)) : 4;
				const hatched = bar.status === "today" && bar.amount > 0;
				return (
					<Pressable
						key={bar.date}
						accessibilityRole="button"
						accessibilityLabel={bar.accessibilityLabel}
						disabled={bar.status === "future"}
						onPress={() => onPressDay(bar.date)}
						style={{ flex: 1, alignItems: "stretch", gap: 6 }}
					>
						<View style={{ height: HEIGHT, justifyContent: "flex-end" }}>
							{bar.maximum !== undefined || bar.minimum !== undefined ? (
								<View
									pointerEvents="none"
									style={{
										position: "absolute",
										left: -3,
										right: -3,
										top: y(bar.maximum ?? bar.minimum ?? 0),
										height: Math.max(
											1,
											y(bar.minimum ?? bar.maximum ?? 0) -
												y(bar.maximum ?? bar.minimum ?? 0),
										),
										borderTopWidth: 1,
										borderBottomWidth: bar.minimum !== undefined ? 1 : 0,
										borderStyle: "dashed",
										borderColor: colors.textMuted,
										backgroundColor: colors.accentDim,
									}}
								/>
							) : null}
							{hatched ? (
								<Svg width="100%" height={height}>
									<Defs>
										<Pattern
											id={`hatch-${bar.date}`}
											width={8}
											height={8}
											patternUnits="userSpaceOnUse"
										>
											<Rect width={8} height={8} fill={colors.surface} />
											{[
												[-2, 2, 2, -2],
												[0, 8, 8, 0],
												[6, 10, 10, 6],
											].map(([x1, y1, x2, y2]) => (
												<Line
													key={`${x1}-${y1}`}
													x1={x1}
													y1={y1}
													x2={x2}
													y2={y2}
													stroke={colors.accent}
													strokeWidth={2.6}
												/>
											))}
										</Pattern>
									</Defs>
									<Rect
										width="100%"
										height={height}
										rx={radius.md}
										fill={`url(#hatch-${bar.date})`}
										stroke={colors.accent}
										strokeWidth={1.5}
									/>
								</Svg>
							) : (
								<View
									style={{
										height,
										borderRadius: radius.md,
										backgroundColor:
											bar.amount > 0 ? fill(bar.status) : colors.surface2,
									}}
								/>
							)}
						</View>
						<AppText
							variant="caption"
							style={{
								textAlign: "center",
								fontWeight: bar.date === today ? "800" : "600",
								color: bar.date === today ? colors.text : colors.textMuted,
							}}
						>
							{bar.label}
						</AppText>
					</Pressable>
				);
			})}
		</View>
	);
}
