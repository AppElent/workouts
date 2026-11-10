import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { api, type Id } from "../../../convex/api";
import { useOnline } from "../../../convex/online";
import { useQuery } from "../../../convex/query-cache";
import { useStalledOffline } from "../../../convex/stalled-offline";
import { dateLocale, useI18n } from "../../../i18n";
import { useConvexErrorMessage } from "../../../i18n/errors";
import { metrics, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { PrimaryButton } from "../../../ui/button";
import { useConfirm } from "../../../ui/confirm-dialog";
import { EmptyState } from "../../../ui/empty-state";
import { FormSection, GroupedSurface, TextAction } from "../../../ui/form";
import {
	SkeletonBlock,
	SkeletonCard,
	SkeletonGroup,
} from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { formatEnduranceRate, formatKilometers } from "./endurance-format";

export function EnduranceDetailScreen({ id }: { id?: Id<"activities"> }) {
	const errorMessage = useConvexErrorMessage();
	const { locale, t } = useI18n();
	const copy = t.endurance;
	const styles = useThemedStyles(createStyles);
	const router = useRouter();
	const confirm = useConfirm();
	const toast = useToast();
	const activity = useQuery(api.enduranceActivities.get, id ? { id } : "skip");
	const online = useOnline();
	const stalledOffline = useStalledOffline(
		Boolean(id) && activity === undefined,
	);
	const remove = useMutation(api.enduranceActivities.remove);
	const [deleting, setDeleting] = useState(false);
	const deleteLock = useRef(false);

	async function onDelete() {
		if (!id || !activity || deleteLock.current) return;
		if (!online) {
			toast.error(copy.offlineDeleteError);
			return;
		}
		const accepted = await confirm({
			title: copy.deleteTitle,
			message: copy.deleteMessage,
			cancelLabel: copy.keepActivity,
			confirmLabel:
				activity.sport === "running" ? copy.deleteRun : copy.deleteRide,
			destructive: true,
		});
		if (!accepted || deleteLock.current) return;
		deleteLock.current = true;
		setDeleting(true);
		try {
			await remove({ id });
			router.replace("/activity-history");
		} catch (error) {
			toast.error(errorMessage(error, copy.deleteError));
		} finally {
			deleteLock.current = false;
			setDeleting(false);
		}
	}

	if (id && activity === undefined) {
		if (stalledOffline)
			return (
				<ScrollView
					style={styles.root}
					contentInsetAdjustmentBehavior="automatic"
					contentContainerStyle={styles.content}
				>
					<EmptyState title={copy.offlineTitle} body={copy.offlineBody} />
				</ScrollView>
			);
		return (
			<ScrollView
				style={styles.root}
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={styles.content}
			>
				<SkeletonGroup label={copy.loading}>
					<SkeletonBlock width="55%" height={28} />
					<SkeletonBlock width="38%" height={14} />
					<SkeletonCard lines={3} />
					<SkeletonCard lines={2} />
				</SkeletonGroup>
			</ScrollView>
		);
	}
	if (!activity) {
		return (
			<ScrollView
				style={styles.root}
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={styles.content}
			>
				<EmptyState title={copy.missing} body={copy.missingBody} />
			</ScrollView>
		);
	}

	const dateText = new Intl.DateTimeFormat(dateLocale(locale), {
		dateStyle: "full",
		timeStyle: "short",
	}).format(new Date(activity.occurredAt));
	const h = Math.floor(activity.durationSeconds / 3600);
	const m = Math.floor((activity.durationSeconds % 3600) / 60);
	const s = activity.durationSeconds % 60;
	const durationText = [h ? `${h} h` : "", `${m} min`, s ? `${s} s` : ""]
		.filter(Boolean)
		.join(" ");

	return (
		<ScrollView
			style={styles.root}
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
		>
			<View style={styles.heading}>
				<AppText variant="title" selectable>
					{activity.title ||
						(activity.sport === "running" ? copy.running : copy.cycling)}
				</AppText>
				<AppText variant="caption" selectable>
					{dateText}
				</AppText>
			</View>
			<GroupedSurface>
				<View style={styles.metricGrid}>
					<Metric
						label={copy.distance}
						value={`${formatKilometers(activity.distanceMeters, locale)} km`}
					/>
					<Metric label={copy.duration} value={durationText} />
					<Metric
						label={activity.sport === "running" ? copy.pace : copy.speed}
						value={formatEnduranceRate(
							activity.sport,
							activity.distanceMeters,
							activity.durationSeconds,
							locale,
						)}
					/>
				</View>
			</GroupedSurface>
			{activity.environment ||
			activity.elevationGainMeters !== undefined ||
			activity.averageHeartRate !== undefined ||
			activity.effort !== undefined ||
			activity.notes ? (
				<FormSection title={copy.details}>
					{activity.environment ? (
						<DetailRow
							label={copy.environment}
							value={
								activity.environment === "indoor" ? copy.indoor : copy.outdoor
							}
						/>
					) : null}
					{activity.elevationGainMeters !== undefined ? (
						<DetailRow
							label={copy.elevation}
							value={`${activity.elevationGainMeters} m`}
						/>
					) : null}
					{activity.averageHeartRate !== undefined ? (
						<DetailRow
							label={copy.heartRate}
							value={`${activity.averageHeartRate} bpm`}
						/>
					) : null}
					{activity.effort !== undefined ? (
						<DetailRow label={copy.effort} value={`${activity.effort}/10`} />
					) : null}
					{activity.notes ? (
						<DetailRow label={copy.notes} value={activity.notes} />
					) : null}
				</FormSection>
			) : null}
			<PrimaryButton
				label={copy.edit}
				onPress={() =>
					router.push({ pathname: "/endurance-editor", params: { id } })
				}
				disabled={deleting}
			/>
			<TextAction
				label={deleting ? copy.deleting : copy.delete}
				onPress={() => void onDelete()}
				tone="destructive"
				disabled={deleting}
			/>
		</ScrollView>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<View style={{ gap: spacing.xs, minWidth: "40%" }}>
			<AppText variant="caption">{label}</AppText>
			<AppText variant="heading" selectable>
				{value}
			</AppText>
		</View>
	);
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<View
			style={{
				minHeight: 48,
				justifyContent: "center",
				gap: spacing.xs,
				paddingVertical: spacing.sm,
			}}
		>
			<AppText variant="label">{label}</AppText>
			<AppText variant="body" selectable>
				{value}
			</AppText>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			alignSelf: "center",
			width: "100%",
			maxWidth: metrics.formMaxWidth,
			paddingHorizontal: metrics.screenGutter,
			paddingTop: spacing.md,
			paddingBottom: spacing.xxl,
			gap: spacing.lg,
		},
		heading: { gap: spacing.sm },
		metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
	});
