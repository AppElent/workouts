import type { EnduranceSport } from "@foundry/core";
import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { useStalledOffline } from "../../../convex/stalled-offline";
import { useI18n } from "../../../i18n";
import { metrics, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { EmptyState } from "../../../ui/empty-state";
import {
	SkeletonBlock,
	SkeletonCard,
	SkeletonGroup,
} from "../../../ui/skeleton";
import { EnduranceEditorForm } from "./endurance-editor-form";

/** Logs a new run or ride, or edits the activity `id` once it loads. */
export function EnduranceEditorScreen({
	id,
	sport,
}: {
	id?: Id<"activities">;
	sport: EnduranceSport;
}) {
	const copy = useI18n().t.endurance;
	const activity = useQuery(api.enduranceActivities.get, id ? { id } : "skip");
	const loading = Boolean(id) && activity === undefined;
	const stalledOffline = useStalledOffline(loading);
	const currentSport = activity?.sport ?? sport;
	const title = id
		? currentSport === "cycling"
			? copy.editRide
			: copy.editRun
		: sport === "cycling"
			? copy.logRide
			: copy.logRun;
	return (
		<>
			<Stack.Screen options={{ title }} />
			{loading && stalledOffline ? (
				<Status>
					<EmptyState title={copy.offlineTitle} body={copy.offlineBody} />
				</Status>
			) : loading ? (
				<Status>
					<SkeletonGroup label={copy.loading}>
						<SkeletonBlock width="45%" height={20} />
						<SkeletonCard lines={3} />
						<SkeletonCard lines={3} />
					</SkeletonGroup>
				</Status>
			) : id && activity === null ? (
				<Status>
					<EmptyState title={copy.missing} body={copy.missingBody} />
				</Status>
			) : (
				<EnduranceEditorForm
					key={id ?? sport}
					sport={currentSport}
					activity={activity ?? undefined}
				/>
			)}
		</>
	);
}

function Status({ children }: { children: ReactNode }) {
	const styles = useThemedStyles(createStyles);
	return (
		<ScrollView
			style={styles.root}
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
		>
			{children}
		</ScrollView>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			paddingHorizontal: metrics.screenGutter,
			paddingVertical: spacing.lg,
			gap: spacing.md,
		},
	});
