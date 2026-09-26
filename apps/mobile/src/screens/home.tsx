import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { useActivityPages } from "../data/activity-data";
import { activityTotals, activityWeek } from "../data/activity-week";
import { useActiveSession } from "../data/session-data";
import { useI18n } from "../i18n";
import { useTokens } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card, Eyebrow, StatBox } from "../ui/coach";
import { EmptyState } from "../ui/empty-state";
import { SkeletonCard, SkeletonGroup, SkeletonList } from "../ui/skeleton";
import { AppText } from "../ui/text";
import { ActivityRow, activityDuration } from "./activity-components";
import { activityCopy } from "./activity-copy";

export function HomeScreen() {
	const router = useRouter();
	const colors = useTokens();
	const { locale } = useI18n();
	const copy = activityCopy(locale);
	const active = useActiveSession();
	const recent = useActivityPages({ limit: 4 });
	const week = activityWeek();
	const weekly = useActivityPages({ from: week.from, to: week.to }, true);
	const totals = activityTotals(weekly.items);
	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			style={{ flex: 1, backgroundColor: colors.bg }}
			contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 32 }}
		>
			<View style={{ gap: 4 }}>
				<AppText variant="caption">
					{new Date().toLocaleDateString(locale, {
						weekday: "long",
						day: "numeric",
						month: "long",
					})}
				</AppText>
				<AppText variant="title">{copy.ready}</AppText>
			</View>
			<Eyebrow>{copy.thisWeek}</Eyebrow>
			{weekly.loading ? (
				<SkeletonGroup label={copy.loading}>
					<SkeletonCard />
				</SkeletonGroup>
			) : (
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
					<StatBox value={String(totals.count)} label={copy.activities} />
					<StatBox
						value={activityDuration(totals.durationSeconds)}
						label={copy.duration}
					/>
				</View>
			)}
			{active === undefined ? (
				<SkeletonGroup label={copy.loading}>
					<SkeletonCard />
				</SkeletonGroup>
			) : active ? (
				<Card>
					<Eyebrow>{copy.inProgress}</Eyebrow>
					<AppText variant="heading">{active.name || copy.session}</AppText>
					<PrimaryButton
						label={copy.resume}
						onPress={() =>
							router.push({ pathname: "/session", params: { id: active._id } })
						}
					/>
				</Card>
			) : (
				<View style={{ gap: 12 }}>
					<AppText variant="caption">{copy.logBody}</AppText>
					<PrimaryButton
						label={copy.startActivity}
						onPress={() => router.push("/start-activity")}
					/>
				</View>
			)}
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				<GhostButton
					label={copy.logRun}
					onPress={() =>
						router.push({
							pathname: "/endurance-editor",
							params: { sport: "running" },
						})
					}
				/>
				<GhostButton
					label={copy.logRide}
					onPress={() =>
						router.push({
							pathname: "/endurance-editor",
							params: { sport: "cycling" },
						})
					}
				/>
			</View>
			<View style={{ gap: 12 }}>
				<Eyebrow>{copy.recent}</Eyebrow>
				{recent.loading ? (
					<SkeletonGroup label={copy.loading}>
						<SkeletonList rows={4} />
					</SkeletonGroup>
				) : recent.items.length ? (
					recent.items.map((item) => (
						<ActivityRow key={`${item.sport}:${item.id}`} item={item} />
					))
				) : (
					<EmptyState title={copy.emptyTitle} body={copy.emptyBody} />
				)}
				<GhostButton
					label={copy.seeAll}
					onPress={() => router.push("/activity-history")}
				/>
			</View>
		</ScrollView>
	);
}
