import type { EnduranceSport } from "@workouts/core";
import { useState } from "react";
import { View } from "react-native";
import { useActivityPages } from "../data/activity-data";
import {
	activityTotals,
	activityWeek,
	activityWeeks,
} from "../data/activity-week";
import { isoDateToLocalDate, shiftIsoDate } from "../data/calendar-day";
import { useI18n } from "../i18n";
import { GhostButton } from "../ui/button";
import { BucketChart } from "../ui/chart";
import { StatBox } from "../ui/coach";
import { EmptyState } from "../ui/empty-state";
import { SkeletonCard, SkeletonGroup } from "../ui/skeleton";
import { AppText } from "../ui/text";
import { activityDuration, activityRate } from "./activity-components";
import { activityCopy } from "./activity-copy";

export function EnduranceProgress({ sport }: { sport: EnduranceSport }) {
	const { locale } = useI18n();
	const copy = activityCopy(locale);
	const current = activityWeek();
	const [selected, setSelected] = useState(current.start);
	const selectedWeek = activityWeek(selected);
	const first = activityWeek(shiftIsoDate(current.start, -77));
	const { items, loading } = useActivityPages(
		{ sport, from: first.from, to: current.to },
		true,
	);
	if (loading)
		return (
			<SkeletonGroup label={copy.loading}>
				<SkeletonCard />
				<SkeletonCard lines={5} />
			</SkeletonGroup>
		);
	const weeks = activityWeeks(items, current.start);
	const totals = activityTotals(
		items.filter(
			(item) =>
				item.occurredAt >= selectedWeek.from &&
				item.occurredAt < selectedWeek.to,
		),
	);
	const points = weeks.map((week) => ({
		label: isoDateToLocalDate(week.start).toLocaleDateString(locale, {
			day: "numeric",
			month: "short",
		}),
		value: week.distanceMeters / 1000,
	}));
	return (
		<View style={{ gap: 16 }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					flexWrap: "wrap",
					gap: 12,
				}}
			>
				<GhostButton
					label={copy.previousWeek}
					disabled={selected <= first.start}
					onPress={() => setSelected(shiftIsoDate(selected, -7))}
				/>
				<GhostButton
					label={copy.nextWeek}
					disabled={selected >= current.start}
					onPress={() => setSelected(shiftIsoDate(selected, 7))}
				/>
			</View>
			<AppText variant="heading">
				{isoDateToLocalDate(selected).toLocaleDateString(locale, {
					day: "numeric",
					month: "long",
				})}{" "}
				–{" "}
				{isoDateToLocalDate(shiftIsoDate(selected, 6)).toLocaleDateString(
					locale,
					{ day: "numeric", month: "long", year: "numeric" },
				)}
			</AppText>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				<StatBox value={String(totals.count)} label={copy.activities} />
				<StatBox
					value={(totals.distanceMeters / 1000).toLocaleString(locale, {
						maximumFractionDigits: 2,
					})}
					unit="km"
					label={copy.distance}
				/>
				<StatBox
					value={activityDuration(totals.durationSeconds)}
					label={copy.duration}
				/>
			</View>
			<StatBox
				value={activityRate(
					sport,
					totals.distanceMeters,
					totals.durationSeconds,
					locale,
				)}
				label={sport === "running" ? copy.pace : copy.speed}
			/>
			{totals.count === 0 ? (
				<EmptyState title={copy.weekEmpty} body={copy.weekEmptyBody} />
			) : null}
			<BucketChart title={copy.weeklyDistance} points={points} />
			<BucketChart
				title={copy.weeklyDuration}
				points={weeks.map((week, i) => ({
					label: points[i].label,
					value: week.durationSeconds / 60,
				}))}
			/>
		</View>
	);
}
