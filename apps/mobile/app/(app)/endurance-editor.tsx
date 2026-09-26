import { useConvexConnectionState, useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { api, type Id } from "../../src/convex/api";
import { useStalledOffline } from "../../src/data/stalled-offline";
import { useI18n } from "../../src/i18n";
import { enduranceCopy } from "../../src/screens/endurance-copy";
import { EnduranceEditorScreen } from "../../src/screens/endurance-editor";
import {
	metrics,
	spacing,
	type Tokens,
	useThemedStyles,
} from "../../src/theme";
import { EmptyState } from "../../src/ui/empty-state";
import { RouteError } from "../../src/ui/route-error";
import {
	SkeletonBlock,
	SkeletonCard,
	SkeletonGroup,
} from "../../src/ui/skeleton";

export default function EnduranceEditorRoute() {
	const { id, sport } = useLocalSearchParams<{ id?: string; sport?: string }>();
	const { locale } = useI18n();
	const copy = enduranceCopy[locale];
	const styles = useThemedStyles(createStyles);
	const [retryNonce, setRetryNonce] = useState(0);
	const activity = useQuery(
		api.enduranceActivities.get,
		id && retryNonce % 2 === 0 ? { id: id as Id<"activities"> } : "skip",
	);
	const { isWebSocketConnected } = useConvexConnectionState();
	const stalledOffline = useStalledOffline(
		Boolean(id) && activity === undefined,
		isWebSocketConnected,
	);
	const chosenSport = sport === "cycling" ? "cycling" : "running";
	const currentSport = activity?.sport ?? chosenSport;
	const title = id
		? currentSport === "cycling"
			? copy.editRide
			: copy.editRun
		: chosenSport === "cycling"
			? copy.logRide
			: copy.logRun;
	return (
		<>
			<Stack.Screen options={{ title }} />
			{id && activity === undefined && stalledOffline ? (
				<ScrollView
					style={styles.root}
					contentInsetAdjustmentBehavior="automatic"
					contentContainerStyle={styles.content}
				>
					<EmptyState
						title={copy.offlineTitle}
						body={copy.offlineBody}
						action={{
							label: copy.retry,
							onPress: () => {
								setRetryNonce((n) => n + 1);
								setTimeout(() => setRetryNonce((n) => n + 1), 0);
							},
						}}
					/>
				</ScrollView>
			) : id && activity === undefined ? (
				<ScrollView
					style={styles.root}
					contentInsetAdjustmentBehavior="automatic"
					contentContainerStyle={styles.content}
				>
					<SkeletonGroup label={copy.loading}>
						<SkeletonBlock width="45%" height={20} />
						<SkeletonCard lines={3} />
						<SkeletonCard lines={3} />
					</SkeletonGroup>
				</ScrollView>
			) : id && activity === null ? (
				<ScrollView
					style={styles.root}
					contentInsetAdjustmentBehavior="automatic"
					contentContainerStyle={styles.content}
				>
					<EmptyState title={copy.missing} body={copy.missingBody} />
				</ScrollView>
			) : (
				<EnduranceEditorScreen
					key={id ?? chosenSport}
					sport={currentSport}
					activity={activity ?? undefined}
				/>
			)}
		</>
	);
}

export function ErrorBoundary({
	error,
	retry,
}: {
	error: Error;
	retry: () => Promise<void>;
}) {
	const { locale } = useI18n();
	const copy = enduranceCopy[locale];
	return (
		<RouteError
			title={copy.missing}
			body={copy.saveError}
			retryLabel={locale === "nl" ? "Opnieuw proberen" : "Retry"}
			onRetry={() => void retry()}
			error={error}
		/>
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
