import { useForm, useStore } from "@tanstack/react-form";
import {
	paceSecondsPerKilometer,
	speedKilometersPerHour,
} from "@workouts/core";
import { useConvexConnectionState, useMutation } from "convex/react";
import { useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/build/react-navigation/core";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { z } from "zod";
import { api, type Id } from "../convex/api";
import { isoDateToLocalDate, todayIsoDate } from "../data/calendar-day";
import { useI18n } from "../i18n";
import { spacing, useTokens } from "../theme";
import { convexErrorMessage, useConfirm } from "../ui/confirm-dialog";
import { DatePickerSheet } from "../ui/date-picker-sheet";
import {
	DisclosureRow,
	FormScreen,
	FormSection,
	FormSegmentedRow,
	FormTextField,
	GroupedSurface,
	InlineNumberFieldRow,
} from "../ui/form";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { enduranceCopy } from "./endurance-copy";
import {
	type EnduranceDetail,
	type EnduranceValues,
	formatPace,
	type ParsedEnduranceValues,
	parseEnduranceValues,
	valuesForActivity,
} from "./endurance-form-state";

function activityId() {
	return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const enduranceFormSchema = z
	.object({
		date: z.string(),
		time: z.string(),
		distance: z.string(),
		hours: z.string(),
		minutes: z.string(),
		seconds: z.string(),
		title: z.string(),
		notes: z.string(),
		environment: z.union([
			z.literal(""),
			z.literal("indoor"),
			z.literal("outdoor"),
		]),
		elevation: z.string(),
		heartRate: z.string(),
		effort: z.string(),
	})
	.superRefine((values, context) => {
		const result = parseEnduranceValues(values, enduranceCopy.en);
		if (result.error)
			context.addIssue({ code: "custom", message: result.error });
	});

function createFields(
	clientEntryId: string,
	sport: "running" | "cycling",
	fields: ParsedEnduranceValues,
) {
	return {
		clientEntryId,
		sport,
		occurredAt: fields.occurredAt,
		durationSeconds: fields.durationSeconds,
		distanceMeters: fields.distanceMeters,
		...(fields.title ? { title: fields.title } : {}),
		...(fields.notes ? { notes: fields.notes } : {}),
		...(fields.environment ? { environment: fields.environment } : {}),
		...(fields.elevationGainMeters !== null
			? { elevationGainMeters: fields.elevationGainMeters }
			: {}),
		...(fields.averageHeartRate !== null
			? { averageHeartRate: fields.averageHeartRate }
			: {}),
		...(fields.effort !== null ? { effort: fields.effort } : {}),
	};
}

export function EnduranceEditorScreen({
	sport,
	activity,
}: {
	sport: "running" | "cycling";
	activity?: EnduranceDetail | null;
}) {
	const router = useRouter();
	const colors = useTokens();
	const navigation = useNavigation();
	const { locale } = useI18n();
	const copy = enduranceCopy[locale];
	const toast = useToast();
	const confirm = useConfirm();
	const create = useMutation(api.enduranceActivities.create);
	const update = useMutation(api.enduranceActivities.update);
	const { isWebSocketConnected } = useConvexConnectionState();
	const initial = useRef(valuesForActivity(activity));
	const today = useRef(todayIsoDate());
	const clientEntryId = useRef(activityId());
	const firstCreatePayload = useRef<ReturnType<typeof createFields> | null>(
		null,
	);
	const resolvedCreatedId = useRef<Id<"activities"> | null>(null);
	const form = useForm({
		defaultValues: initial.current,
		validators: { onSubmit: enduranceFormSchema },
		onSubmit: async ({ value }) => save(value),
	});
	const values = useStore(form.store, (state) => state.values);
	const [expanded, setExpanded] = useState(
		Boolean(
			activity?.notes ||
				activity?.elevationGainMeters ||
				activity?.averageHeartRate ||
				activity?.effort ||
				activity?.environment === "indoor",
		),
	);
	const [saving, setSaving] = useState(false);
	const [showDatePicker, setShowDatePicker] = useState(false);
	const lock = useRef(false);
	const [allowLeave, setAllowLeave] = useState(false);
	const pendingNavigation = useRef<(() => void) | null>(null);
	const dirty = JSON.stringify(values) !== JSON.stringify(initial.current);

	usePreventRemove((dirty || saving) && !allowLeave, ({ data }) => {
		if (saving) return;
		void (async () => {
			const discard = await confirm({
				title: copy.discardTitle,
				message: copy.discardMessage,
				confirmLabel: copy.discard,
				cancelLabel: copy.keepEditing,
				destructive: true,
			});
			if (!discard) return;
			pendingNavigation.current = () => navigation.dispatch(data.action);
			setAllowLeave(true);
		})();
	});
	useEffect(() => {
		if (!allowLeave || !pendingNavigation.current) return;
		const next = pendingNavigation.current;
		pendingNavigation.current = null;
		next();
	}, [allowLeave]);

	const set = <K extends keyof EnduranceValues>(
		key: K,
		value: EnduranceValues[K],
	) => {
		// Every field in this form is stored as text; the generic wrapper keeps
		// callers paired with the correct key while TanStack accepts a concrete path.
		form.setFieldValue(key as "date", value as string);
	};
	const parsed = parseEnduranceValues(values, copy);
	const metric = parsed.value
		? sport === "running"
			? paceSecondsPerKilometer(
					parsed.value.distanceMeters,
					parsed.value.durationSeconds,
				)
			: speedKilometersPerHour(
					parsed.value.distanceMeters,
					parsed.value.durationSeconds,
				)
		: null;
	const metricText =
		sport === "running"
			? formatPace(metric)
			: metric === null || !Number.isFinite(metric)
				? "—"
				: `${metric.toLocaleString(locale, { maximumFractionDigits: 1 })} km/h`;

	async function save(submitted: EnduranceValues) {
		const submission = parseEnduranceValues(submitted, copy);
		if (!submission.value) return;
		if (!isWebSocketConnected) {
			toast.error(copy.offlineError);
			return;
		}
		try {
			const fields = submission.value;
			if (activity) {
				await update({ id: activity.id as Id<"activities">, ...fields });
				pendingNavigation.current = () => router.back();
			} else {
				// A prior request can commit even when its response is lost. Resolve
				// that original request first, then apply edits to its one activity.
				const currentPayload = createFields(
					clientEntryId.current,
					sport,
					fields,
				);
				firstCreatePayload.current ??= currentPayload;
				const id =
					resolvedCreatedId.current ??
					(await create(firstCreatePayload.current));
				resolvedCreatedId.current = id;
				if (
					JSON.stringify(currentPayload) !==
					JSON.stringify(firstCreatePayload.current)
				) {
					await update({ id, ...fields });
				}
				pendingNavigation.current = () => router.replace(`/endurance/${id}`);
			}
			setAllowLeave(true);
		} catch (error) {
			toast.error(convexErrorMessage(error, copy.saveError));
		}
	}

	function submit() {
		if (lock.current) return;
		lock.current = true;
		setSaving(true);
		void form.handleSubmit().finally(() => {
			lock.current = false;
			setSaving(false);
		});
	}

	return (
		<>
			<DatePickerSheet
				visible={showDatePicker}
				date={values.date}
				today={today.current}
				locale={locale}
				title={copy.date}
				todayLabel={copy.today}
				doneLabel={copy.done}
				closeLabel={copy.close}
				onSelect={(date) => {
					set("date", date);
					setShowDatePicker(false);
				}}
				onClose={() => setShowDatePicker(false)}
			/>
			<FormScreen
				primaryAction={{
					label: saving ? copy.saving : copy.save,
					onPress: submit,
					loading: saving,
					disabled: !parsed.value || saving,
				}}
			>
				<FormSection title={sport === "running" ? copy.running : copy.cycling}>
					<DisclosureRow
						label={copy.date}
						value={isoDateToLocalDate(values.date).toLocaleDateString(
							locale === "nl" ? "nl-NL" : "en-GB",
							{ dateStyle: "medium" },
						)}
						onPress={() => setShowDatePicker(true)}
					/>
					<FormTextField
						label={copy.time}
						value={values.time}
						onChangeText={(v) => set("time", v)}
						placeholder={copy.timeHint}
						keyboardType="numbers-and-punctuation"
						autoCapitalize="none"
					/>
					<InlineNumberFieldRow
						label={copy.distance}
						suffix="km"
						value={values.distance}
						onChangeText={(v) => set("distance", v)}
						keyboardType="decimal-pad"
					/>
				</FormSection>
				<FormSection
					title={copy.duration}
					footer={
						copy.invalidDuration === parsed.error ? parsed.error : undefined
					}
				>
					<InlineNumberFieldRow
						label={copy.hours}
						suffix="h"
						value={values.hours}
						onChangeText={(v) => set("hours", v)}
						keyboardType="number-pad"
					/>
					<InlineNumberFieldRow
						label={copy.minutes}
						suffix="min"
						value={values.minutes}
						onChangeText={(v) => set("minutes", v)}
						keyboardType="number-pad"
					/>
					<InlineNumberFieldRow
						label={copy.seconds}
						suffix="s"
						value={values.seconds}
						onChangeText={(v) => set("seconds", v)}
						keyboardType="number-pad"
					/>
				</FormSection>
				{dirty && parsed.error && parsed.error !== copy.invalidDuration ? (
					<AppText accessibilityRole="alert" style={{ color: colors.danger }}>
						{parsed.error}
					</AppText>
				) : null}
				<GroupedSurface>
					<View style={{ gap: spacing.xs }}>
						<AppText variant="label">
							{sport === "running" ? copy.pace : copy.speed}
						</AppText>
						<AppText variant="metric" selectable>
							{metricText}
						</AppText>
					</View>
				</GroupedSurface>
				<FormSection>
					<DisclosureRow
						label={copy.moreDetails}
						expanded={expanded}
						onPress={() => setExpanded((current) => !current)}
					/>
				</FormSection>
				{expanded ? (
					<>
						<FormSection title={copy.details}>
							<FormTextField
								label={copy.title}
								value={values.title}
								onChangeText={(v) => set("title", v)}
							/>
							<FormTextField
								label={copy.notes}
								value={values.notes}
								onChangeText={(v) => set("notes", v)}
								multiline
							/>
							<FormSegmentedRow
								options={[
									{ value: "", label: copy.unspecified },
									{ value: "outdoor", label: copy.outdoor },
									{ value: "indoor", label: copy.indoor },
								]}
								value={values.environment}
								onChange={(v) => set("environment", v)}
							/>
						</FormSection>
						<FormSection>
							<InlineNumberFieldRow
								label={copy.elevation}
								suffix="m"
								value={values.elevation}
								onChangeText={(v) => set("elevation", v)}
								keyboardType="decimal-pad"
							/>
							<InlineNumberFieldRow
								label={copy.heartRate}
								suffix="bpm"
								value={values.heartRate}
								onChangeText={(v) => set("heartRate", v)}
								keyboardType="number-pad"
							/>
							<InlineNumberFieldRow
								label={copy.effort}
								suffix="/10"
								value={values.effort}
								onChangeText={(v) => set("effort", v)}
								keyboardType="number-pad"
							/>
						</FormSection>
					</>
				) : null}
			</FormScreen>
		</>
	);
}
