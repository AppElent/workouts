import { NUTRIENT_KEYS, totalNutrients } from "@workouts/core/nutrition";
import { useConvexConnectionState } from "convex/react";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import {
	formatLongDate,
	isoDayOffset,
	todayIsoDate,
} from "../../../data/calendar-day";
import { useDeleteDiaryEntry } from "../../../data/delete-diary-entry";
import {
	type DiaryEntry,
	type DiaryEntryWithMeal,
	MEAL_SLOTS,
	type MealSlot,
	useNutritionDay,
} from "../../../data/nutrition-day";
import type { CaptureDraft } from "../../../data/nutrition-draft-repository";
import { useNutritionDrafts } from "../../../data/nutrition-drafts";
import { useNutritionOperations } from "../../../data/nutrition-operation-service";
import { isRealIsoDate } from "../../../data/nutrition-weekly-review";
import { useStalledOffline } from "../../../data/stalled-offline";
import { useTrainingMarker } from "../../../data/training-marker";
import { fmt, useI18n } from "../../../i18n";
import { NutritionDraftEditor } from "../../../screens/nutrition-draft-editor";
import { NutritionSyncStatus } from "../../../screens/nutrition-sync-status";
import { spacing, useTokens } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { GlassSurface } from "../../../ui/glass-surface";
import { SkeletonBlock, SkeletonGroup } from "../../../ui/skeleton";
import { useTabBarVisibility } from "../../../ui/tab-bar-visibility";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { NutritionHeaderMenu } from "../components/nutrition-header-menu";
import { DiaryDatePicker } from "./components/diary-date-picker";
import { DiaryMealCard } from "./components/diary-meal-card";
import { DiarySelectionActions } from "./components/diary-selection-actions";
import { DiarySummary } from "./components/diary-summary";
import { DiaryWeekStrip } from "./components/diary-week-strip";
import { useDiaryDateRequest } from "./use-diary-date-request";

export function DiaryScreen({
	initialDate,
	startSelecting,
}: {
	initialDate?: string;
	startSelecting?: string;
} = {}) {
	const { t, locale } = useI18n();
	const colors = useTokens();
	const router = useRouter();
	const confirm = useConfirm();
	const toast = useToast();
	const [today] = useState(todayIsoDate);
	const [date, setDate] = useState(
		initialDate && isRealIsoDate(initialDate) ? initialDate : today,
	);
	const [showTools, setShowTools] = useState(false);
	const [selecting, setSelecting] = useState(Boolean(startSelecting));
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	const [deleting, setDeleting] = useState(false);
	const [editingDraft, setEditingDraft] = useState<CaptureDraft>();
	const { deleteEntry } = useDeleteDiaryEntry();
	const drafts = useNutritionDrafts();
	const operations = useNutritionOperations();
	const state = useNutritionDay(date);
	const marker = useTrainingMarker(date);
	const connected = useConvexConnectionState().isWebSocketConnected;
	const stalled = useStalledOffline(state.status === "loading", connected);
	const goalsStalled = useStalledOffline(
		state.status === "ready" && Boolean(state.day.goalsPending),
		connected,
	);
	const { setHidden } = useTabBarVisibility();
	useEffect(() => {
		setHidden(selecting);
		return () => setHidden(false);
	}, [selecting, setHidden]);
	useEffect(() => {
		if (initialDate && isRealIsoDate(initialDate)) {
			setDate(initialDate);
			setSelected(new Set());
			setSelecting(false);
		}
	}, [initialDate]);
	useEffect(() => {
		if (startSelecting) {
			setSelecting(true);
			setSelected(new Set());
		}
	}, [startSelecting]);
	const entries: DiaryEntryWithMeal[] =
		state.status === "ready"
			? MEAL_SLOTS.flatMap((meal) =>
					state.day.entries[meal].map((e) => ({ ...e, meal })),
				)
			: [];
	const selectedEntries = entries.filter((e) => selected.has(e.id));
	const totals = {
		...totalNutrients(entries.map((e) => e.nutrients)),
		...(state.status === "ready" ? state.day.totals : {}),
	};
	for (const n of NUTRIENT_KEYS) {
		if (
			entries.some((e) => e.estimated && e.nutrients[n].kind !== "absent") &&
			totals[n]
		)
			totals[n] = { ...totals[n], qualified: true };
	}
	const offset = isoDayOffset(today, date);
	const dayLabel =
		offset === 0
			? t.nutrition.day.today
			: offset === -1
				? t.nutrition.day.yesterday
				: offset === 1
					? t.nutrition.day.tomorrow
					: formatLongDate(date, locale);
	const changeDate = (next: string) => {
		setDate(next);
		setSelecting(false);
		setSelected(new Set());
	};
	// The log food screen above may have moved to another day; follow it.
	useDiaryDateRequest(changeDate);
	const beginSelection = (items: readonly DiaryEntry[]) => {
		setSelected(new Set(items.map((e) => e.id)));
		setSelecting(true);
	};
	const toggle = (items: readonly DiaryEntry[]) =>
		setSelected((current) => {
			const next = new Set(current);
			const all = items.every((e) => next.has(e.id));
			for (const e of items) {
				if (all) next.delete(e.id);
				else next.add(e.id);
			}
			return next;
		});
	const endSelection = () => {
		setSelecting(false);
		setSelected(new Set());
	};
	const transfer = (items: readonly DiaryEntry[], mode: "copy" | "move") => {
		if (!items.length) return;
		router.push({
			pathname: "/nutrition-entry-transfer",
			params: { date, entryIds: items.map((e) => e.id).join(","), mode },
		});
		endSelection();
	};
	const combo = (items: readonly DiaryEntry[]) => {
		if (!items.length) return;
		router.push({
			pathname: "/nutrition-combo-new",
			params: { date, entryIds: items.map((e) => e.id).join(",") },
		});
		endSelection();
	};
	const removeSelected = async () => {
		if (deleting || !selectedEntries.length) return;
		if (
			!(await confirm({
				title: locale === "nl" ? "Selectie verwijderen?" : "Delete selection?",
				message: `${selectedEntries.length} items`,
				confirmLabel: t.nutrition.entryActions.delete,
				destructive: true,
			}))
		)
			return;
		const subject = operations.getSubject();
		if (!subject) return;
		setDeleting(true);
		try {
			operations.removeBatch(
				subject,
				selectedEntries.map((e) =>
					e.id.startsWith("client:")
						? { kind: "clientEntryId", id: e.id.slice(7) }
						: { kind: "serverId", id: e.id },
				),
				() => {
					setDeleting(false);
					toast.error(t.nutrition.error.body);
				},
				() => {
					setDeleting(false);
					endSelection();
				},
			);
		} catch {
			setDeleting(false);
			toast.error(t.nutrition.error.body);
		}
	};
	const add = (meal: MealSlot) =>
		router.push({ pathname: "/nutrition-food", params: { meal, date } });
	const menu = (
		<NutritionHeaderMenu
			label={locale === "nl" ? "Meer voedingsfuncties" : "More nutrition tools"}
			closeLabel={t.diaryEntry.cancel}
			selectLabel={locale === "nl" ? "Selecteer" : "Select"}
			onSelect={() => beginSelection([])}
			weekOverviewLabel={locale === "nl" ? "Weekoverzicht" : "Week overview"}
			foodLibraryLabel={
				locale === "nl" ? "Voedingsbibliotheek" : "Food library"
			}
			settingsLabel={locale === "nl" ? "Instellingen" : "Settings"}
			assistanceLabel={
				locale === "nl" ? "Tekst en voedingsetiket" : "Text and nutrition label"
			}
			goalsLabel={t.nutrition.goals.edit}
			dataSourcesLabel={locale === "nl" ? "Gegevensbronnen" : "Data sources"}
			onOpenWeekOverview={() =>
				router.push({
					pathname: "/nutrition-weekly-review",
					params: { startDate: date },
				})
			}
			onOpenFoodLibrary={() => router.push("/nutrition-library")}
			onOpenSettings={() => router.push("/nutrition-settings")}
			onOpenAssistance={() =>
				router.push({
					pathname: "/nutrition-assistance",
					params: { date, meal: "breakfast" },
				})
			}
			onOpenGoals={() =>
				router.push({ pathname: "/nutrition-goals", params: { date } })
			}
			onToggleDataSources={() => setShowTools((v) => !v)}
		/>
	);
	const calendarLabel = locale === "nl" ? "Kies datum" : "Choose date";
	const actionLabels = {
		copy: locale === "nl" ? "Kopiëren" : "Copy",
		move: locale === "nl" ? "Verplaatsen" : "Move",
		combo: locale === "nl" ? "Combo maken" : "Make combo",
	};
	return (
		<>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ flex: 1, backgroundColor: colors.bg }}
				contentContainerStyle={{
					paddingHorizontal: spacing.md,
					paddingBottom: spacing.xxl,
					gap: spacing.sm,
				}}
				keyboardShouldPersistTaps="handled"
			>
				<AppText variant="secondary">{formatLongDate(date, locale)}</AppText>
				{!selecting ? (
					<DiaryWeekStrip
						date={date}
						onChange={changeDate}
						loggedDates={entries.length ? new Set([date]) : undefined}
					/>
				) : null}

				{marker === "visible" ? (
					<View
						accessible
						accessibilityLabel={t.nutrition.trainingMarker.description}
					>
						<AppText variant="caption">
							{t.nutrition.trainingMarker.label}
						</AppText>
					</View>
				) : null}
				{showTools ? (
					<View>
						<AppText variant="caption">{t.nutrition.attribution.nevo}</AppText>
						<AppText variant="caption">{t.nutrition.attribution.salt}</AppText>
						<AppText variant="caption">
							{t.nutrition.attribution.incomplete}
						</AppText>
					</View>
				) : null}
				{stalled ? (
					<View>
						<AppText variant="heading">{t.nutrition.offline.title}</AppText>
						<AppText>{t.nutrition.offline.body}</AppText>
						{MEAL_SLOTS.map((slot) => (
							<Pressable
								key={slot}
								accessibilityRole="button"
								accessibilityLabel={fmt(t.nutrition.addTo, {
									meal: t.nutrition.meals[slot],
								})}
								onPress={() => add(slot)}
								style={{ minHeight: 48, justifyContent: "center" }}
							>
								<AppText>{t.nutrition.meals[slot]} +</AppText>
								<AppText>{t.nutrition.offline.slot}</AppText>
							</Pressable>
						))}
					</View>
				) : state.status === "loading" ? (
					<SkeletonGroup label={t.nutrition.day.loading}>
						<SkeletonBlock height={180} />
					</SkeletonGroup>
				) : (
					<>
						<NutritionSyncStatus />
						{!state.day.complete ? (
							<AppText variant="caption">
								{locale === "nl"
									? "Alleen lokaal beschikbare invoer. Dagtotaal is onvolledig."
									: "Only locally available entries. Day totals are incomplete."}
							</AppText>
						) : null}
						{state.day.goalsCached ? (
							<AppText variant="caption">
								{locale === "nl"
									? "Laatst opgeslagen doelen; mogelijk niet actueel."
									: "Last cached goals; may not be current."}
							</AppText>
						) : null}
						{state.day.goalBasis === "reference" && offset !== 0 ? (
							<AppText variant="caption">
								{locale === "nl"
									? "Referentiedoelen — historische doelen zijn niet bekend."
									: "Reference goals — historical targets are not known."}
							</AppText>
						) : null}
						{selecting ? null : state.day.goalsPending ? (
							goalsStalled ? (
								<AppText>{t.nutrition.offline.goals}</AppText>
							) : (
								<SkeletonGroup label={t.nutrition.goalEditor.loading}>
									<SkeletonBlock height={160} />
								</SkeletonGroup>
							)
						) : (
							<DiarySummary
								goals={state.day.goals}
								onSetup={() =>
									router.push({
										pathname: "/nutrition-goals",
										params: { date },
									})
								}
								totals={totals}
								onOpen={() =>
									router.push({
										pathname: "/nutrition-day-goals",
										params: { date },
									})
								}
							/>
						)}
						{MEAL_SLOTS.map((slot) => (
							<DiaryMealCard
								key={slot}
								slot={slot}
								entries={state.day.entries[slot]}
								drafts={drafts.listForDate(date).filter((d) => d.meal === slot)}
								complete={state.day.complete}
								selecting={selecting}
								selected={selected}
								onToggle={toggle}
								onSelect={beginSelection}
								onAdd={() => add(slot)}
								onEdit={(entry) =>
									router.push({
										pathname: "/nutrition-entry",
										params: { id: entry.id, date, meal: slot },
									})
								}
								onDelete={(entry) =>
									void deleteEntry({ entry, meal: slot, date })
								}
								onTransfer={transfer}
								onCombo={combo}
								onResolveDraft={(draft) =>
									router.push({
										pathname: "/nutrition-food",
										params: {
											date: draft.date,
											meal: draft.meal,
											draftId: draft.id,
											query: draft.note,
										},
									})
								}
								onEditDraft={setEditingDraft}
								onDeleteDraft={(draft) => {
									void confirm({
										title: t.nutrition.drafts.deleteTitle,
										message: t.nutrition.drafts.deleteBody,
										confirmLabel: t.nutrition.drafts.deleteConfirm,
										destructive: true,
									}).then((ok) => {
										if (ok) {
											try {
												if (!drafts.remove(draft.id))
													toast.error(t.nutrition.drafts.deleteFailure);
											} catch {
												toast.error(t.nutrition.drafts.deleteFailure);
											}
										}
									});
								}}
							/>
						))}
					</>
				)}
			</ScrollView>
			<Stack.Screen
				options={{
					title: selecting
						? `${selectedEntries.length} ${locale === "nl" ? "geselecteerd" : "selected"}`
						: dayLabel,
					headerLargeTitleEnabled: true,
					headerRight: () =>
						selecting ? (
							<Pressable
								accessibilityRole="button"
								onPress={endSelection}
								disabled={deleting}
								style={{ minHeight: 48, justifyContent: "center" }}
							>
								<AppText>{t.diaryEntry.cancel}</AppText>
							</Pressable>
						) : Platform.OS === "ios" ? null : (
							<View style={{ flexDirection: "row", alignItems: "center" }}>
								<DiaryDatePicker
									date={date}
									onSelect={changeDate}
									locale={locale}
									label={calendarLabel}
								/>
								{menu}
							</View>
						),
				}}
			/>
			{!selecting && Platform.OS === "ios" ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.View hidesSharedBackground>
						<GlassSurface capsule>
							<DiaryDatePicker
								date={date}
								onSelect={changeDate}
								locale={locale}
								label={calendarLabel}
							/>
						</GlassSurface>
					</Stack.Toolbar.View>
					<Stack.Toolbar.Spacer width={8} />
					<Stack.Toolbar.View hidesSharedBackground>
						<GlassSurface capsule>{menu}</GlassSurface>
					</Stack.Toolbar.View>
				</Stack.Toolbar>
			) : null}

			{selecting && Platform.OS === "ios" ? (
				<Stack.Toolbar placement="bottom">
					<Stack.Toolbar.View>
						<DiarySelectionActions
							labels={{
								...actionLabels,
								delete: t.nutrition.entryActions.delete,
							}}
							disabled={!selectedEntries.length || deleting}
							onCopy={() => transfer(selectedEntries, "copy")}
							onMove={() => transfer(selectedEntries, "move")}
							onCombo={() => combo(selectedEntries)}
							onDelete={() => void removeSelected()}
						/>
					</Stack.Toolbar.View>
				</Stack.Toolbar>
			) : selecting ? (
				<View
					style={{
						flexDirection: "row",
						padding: spacing.md,
						gap: spacing.sm,
						backgroundColor: colors.surface,
					}}
				>
					{[
						{
							label: actionLabels.copy,
							fn: () => transfer(selectedEntries, "copy"),
						},
						{
							label: actionLabels.move,
							fn: () => transfer(selectedEntries, "move"),
						},
						{ label: actionLabels.combo, fn: () => combo(selectedEntries) },
						{
							label: t.nutrition.entryActions.delete,
							fn: () => void removeSelected(),
						},
					].map((a) => (
						<Pressable
							key={a.label}
							accessibilityRole="button"
							disabled={!selectedEntries.length || deleting}
							onPress={a.fn}
							style={{ minHeight: 48, flex: 1 }}
						>
							<AppText>{a.label}</AppText>
						</Pressable>
					))}
				</View>
			) : null}
			{editingDraft ? (
				<NutritionDraftEditor
					draft={editingDraft}
					onClose={() => setEditingDraft(undefined)}
				/>
			) : null}
		</>
	);
}
