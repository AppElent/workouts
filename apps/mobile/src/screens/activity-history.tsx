import type { ActivitySport } from "@workouts/core";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useActivityPages } from "../data/activity-data";
import { useI18n } from "../i18n";
import { useTokens } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { Segmented } from "../ui/segmented";
import { SkeletonGroup, SkeletonList } from "../ui/skeleton";
import { ActivityRow } from "./activity-components";
import { activityCopy } from "./activity-copy";

export function ActivityHistoryScreen() {
	const params = useLocalSearchParams<{ sport?: string }>();
	const [sport, setSport] = useState<ActivitySport | "all">(
		params.sport === "running" ||
			params.sport === "cycling" ||
			params.sport === "strength"
			? params.sport
			: "all",
	);
	const { locale } = useI18n();
	const copy = activityCopy(locale);
	const colors = useTokens();
	const router = useRouter();
	const { items, loading, hasMore, loadMore } = useActivityPages(
		sport === "all" ? {} : { sport },
	);
	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			style={{ flex: 1, backgroundColor: colors.bg }}
			contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
		>
			<Stack.Screen options={{ title: copy.history }} />
			<Segmented
				value={sport}
				onChange={setSport}
				options={(["all", "strength", "running", "cycling"] as const).map(
					(value) => ({ value, label: copy[value] }),
				)}
			/>
			<PrimaryButton
				label={
					sport === "running"
						? copy.logRun
						: sport === "cycling"
							? copy.logRide
							: copy.startActivity
				}
				onPress={() =>
					sport === "running" || sport === "cycling"
						? router.push({ pathname: "/endurance-editor", params: { sport } })
						: router.push("/start-activity")
				}
			/>
			<View style={{ gap: 8 }}>
				{items.map((item) => (
					<ActivityRow key={`${item.sport}:${item.id}`} item={item} />
				))}
			</View>
			{loading ? (
				<SkeletonGroup label={copy.loading}>
					<SkeletonList />
				</SkeletonGroup>
			) : items.length === 0 ? (
				<EmptyState
					title={copy.emptyTitle}
					body={sport === "all" ? copy.emptyBody : copy.filteredEmpty}
				/>
			) : null}
			{hasMore && !loading ? (
				<GhostButton label={copy.loadMore} onPress={loadMore} />
			) : null}
		</ScrollView>
	);
}
