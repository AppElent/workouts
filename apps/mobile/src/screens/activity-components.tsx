import {
	type ActivitySummary,
	paceSecondsPerKilometer,
	speedKilometersPerHour,
} from "@workouts/core";
import type { ErrorBoundaryProps } from "expo-router";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useI18n } from "../i18n";
import { useTokens } from "../theme";
import { SportIcon } from "../ui/coach";
import { RouteError } from "../ui/route-error";
import { AppText } from "../ui/text";
import { activityCopy } from "./activity-copy";
import { formatPace } from "./endurance-form-state";

export function activityDuration(seconds: number) {
	const total = Math.round(seconds);
	return total >= 3600
		? `${Math.floor(total / 3600)}:${String(Math.floor(total / 60) % 60).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
		: `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function activityRate(
	sport: string,
	meters: number,
	seconds: number,
	locale: string,
) {
	const rate =
		sport === "running"
			? paceSecondsPerKilometer(meters, seconds)
			: speedKilometersPerHour(meters, seconds);
	if (rate === null) return "—";
	if (sport === "running") return formatPace(rate);
	return `${rate.toLocaleString(locale, { maximumFractionDigits: 1 })} km/h`;
}

export function ActivityRow({ item }: { item: ActivitySummary }) {
	const router = useRouter();
	const colors = useTokens();
	const { locale } = useI18n();
	const copy = activityCopy(locale);
	const title =
		item.title ||
		(item.sport === "running"
			? copy.run
			: item.sport === "cycling"
				? copy.ride
				: copy.session);
	return (
		<Pressable
			accessibilityRole="button"
			onPress={() =>
				item.sport === "strength"
					? router.push({ pathname: "/summary", params: { id: item.id } })
					: router.push({
							pathname: "/endurance/[id]",
							params: { id: item.id },
						})
			}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 12,
				padding: 16,
				backgroundColor: colors.surface,
				borderRadius: 14,
				borderCurve: "continuous",
			}}
		>
			<SportIcon sport={item.sport} size={36} />
			<View style={{ flex: 1, gap: 4 }}>
				<AppText variant="heading">{title}</AppText>
				<AppText variant="caption">
					{new Date(item.occurredAt).toLocaleDateString(locale, {
						day: "numeric",
						month: "short",
						year: "numeric",
					})}{" "}
					· {activityDuration(item.durationSeconds)}
				</AppText>
				{item.distanceMeters !== undefined ? (
					<AppText variant="caption">
						{(item.distanceMeters / 1000).toLocaleString(locale, {
							maximumFractionDigits: 2,
						})}{" "}
						km ·{" "}
						{activityRate(
							item.sport,
							item.distanceMeters,
							item.durationSeconds,
							locale,
						)}
					</AppText>
				) : null}
			</View>
		</Pressable>
	);
}

export function ActivityErrorBoundary({ error, retry }: ErrorBoundaryProps) {
	const { locale } = useI18n();
	const copy = activityCopy(locale);
	return (
		<RouteError
			title={copy.errorTitle}
			body={copy.errorBody}
			retryLabel={copy.retry}
			onRetry={retry}
			error={error}
		/>
	);
}
