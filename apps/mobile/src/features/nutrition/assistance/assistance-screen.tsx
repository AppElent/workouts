import { nevoAttribution, roundForDisplay } from "@foundry/core/nutrition";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import type {
	NativeStackNavigationOptions,
	NativeStackNavigationProp,
} from "expo-router";
import { Stack, useNavigation, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	Pressable,
	ScrollView,
	TextInput,
	type TextInputInstance,
	View,
} from "react-native";
import { todayIsoDate } from "../../../data/calendar-day";
import { useFoodAuthoringIntent } from "../../../data/food-authoring-intent";
import {
	combinedNutrients,
	diarySnapshots,
	itemNutrients,
	type ReviewItem,
	readyToLog,
	reviewTotals,
} from "../../../data/nutrition-ai";
import { buildAssistanceFoodCatalog } from "../../../data/nutrition-assistance";
import type { MealSlot } from "../../../data/nutrition-day";
import { useNutritionDrafts } from "../../../data/nutrition-drafts";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../../../data/nutrition-operation-service";
import {
	modalAnimation,
	useReduceMotion,
} from "../../../feedback/reduce-motion";
import { fmt, plural, useI18n } from "../../../i18n";
import { radius, spacing, type, useTokens } from "../../../theme";
import { PrimaryButton } from "../../../ui/button";
import { DatePickerSheet } from "../../../ui/date-picker-sheet";
import type { SFSymbol } from "../../../ui/inset-list.types";
import { SkeletonBlock, SkeletonGroup } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { ComboNewScreen } from "../combo/combo-new-screen";
import { comboPartFromEntry } from "../combo/combo-parts";
import {
	FoodFormCard,
	FoodFormMenuValue,
	FoodFormSectionHeader,
} from "../components/food-form-section";
import { FoodPhotoCamera } from "../components/food-photo-camera";
import { NutritionAiConsent } from "../components/nutrition-ai-consent";
import { NutritionChoiceMenu } from "../components/nutrition-choice-menu";
import { NutritionDestinationMenu } from "../components/nutrition-destination-menu";
import { PersonalFoodEditor } from "../personal-food/personal-food-editor";
import { Notice } from "../personal-food/personal-food-label-scan";
import { useMealDestinationMenu } from "../use-meal-destination-menu";
import { AssistanceItemSheet } from "./assistance-item-sheet";
import { useAssistanceSession } from "./use-assistance-session";

type SaveAs = "items" | "combo" | "one";

/**
 * Hulp bij invoeren (designs/nutrition/ai-entry_final.html): describe or
 * photograph what was eaten, review the matched items, then log them as
 * separate entries, a Combo, or one entry. Nothing is saved before the button.
 */
export function AssistanceScreen({
	date: initialDate,
	meal: initialMeal,
	text: initialText = "",
	draftId,
	fromFoodBrowser = false,
}: {
	date: string;
	meal: MealSlot;
	text?: string;
	/** The Capture Draft being processed; removed once its food is logged. */
	draftId?: string;
	/** Opened from Log food, which is then the screen beneath this sheet. */
	fromFoodBrowser?: boolean;
}) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.assistance;
	const colors = useTokens();
	const router = useRouter();
	const toast = useToast();
	const reduceMotion = useReduceMotion();
	const operations = useNutritionOperations();
	const authoring = useFoodAuthoringIntent();
	const session = useAssistanceSession(initialText);
	const [destination, setDestination] = useState({
		date: initialDate,
		meal: initialMeal,
	});
	const drafts = useNutritionDrafts({
		startDate: destination.date,
		endDate: destination.date,
		recordId: draftId,
	});
	const [today] = useState(todayIsoDate);
	const [choosingDay, setChoosingDay] = useState(false);
	const [camera, setCamera] = useState(false);
	const [saveAs, setSaveAs] = useState<SaveAs>("items");
	const [editing, setEditing] = useState<ReviewItem>();
	const [logging, setLogging] = useState(false);
	const [makingCombo, setMakingCombo] = useState(false);
	const lock = useRef(false);
	// Focusing while the sheet still presents scrolls the field to where the
	// header's inset will be, leaving the text under the header.
	const navigation =
		useNavigation<
			NativeStackNavigationProp<Record<string, object | undefined>>
		>();
	const [presented, setPresented] = useState(false);
	useEffect(() => {
		const fallback = setTimeout(() => setPresented(true), 700);
		const unsubscribe = navigation.addListener("transitionEnd", (event) => {
			if (!event.data.closing) setPresented(true);
		});
		return () => {
			clearTimeout(fallback);
			unsubscribe();
		};
	}, [navigation]);
	const destinationMenu = useMealDestinationMenu({
		date: destination.date,
		meal: destination.meal,
		today,
		onSelectMeal: (meal) => setDestination((d) => ({ ...d, meal })),
		onOtherDay: () => setChoosingDay(true),
	});
	const close = () =>
		router.canGoBack()
			? router.back()
			: router.replace({
					pathname: "/nutrition",
					params: { date: destination.date },
				});
	const closeRef = useRef(close);
	closeRef.current = close;
	const menuRef = useRef(destinationMenu.menu);
	menuRef.current = destinationMenu.menu;
	const menu = destinationMenu.menu;
	// biome-ignore lint/correctness/useExhaustiveDependencies: handlers and the menu come from refs
	const options = useMemo(
		(): NativeStackNavigationOptions => ({
			title: copy.title,
			headerShown: true,
			// Clears what the label editor put on the right while it owned the header.
			unstable_headerRightItems: () => [],
			headerTitle: () => (
				<NutritionDestinationMenu {...menuRef.current} title={copy.title} />
			),
			headerLeft: () => (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={copy.cancel}
					onPress={() => closeRef.current()}
					style={{
						minWidth: 44,
						minHeight: 44,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<SymbolView
						name={{ ios: "xmark", android: "close", web: "close" }}
						size={18}
						weight="semibold"
						tintColor={colors.text}
					/>
				</Pressable>
			),
		}),
		[copy, colors.text, menu.label, menu.dayLabel, menu.mealName],
	);

	const { phase } = session;

	function logItems(
		items: readonly ReviewItem[],
		comboGroup?: {
			id: string;
			comboId: string;
			name: string;
		},
	) {
		const subject = operations.getSubject();
		if (lock.current || !subject) return Promise.resolve();
		lock.current = true;
		setLogging(true);
		const entries = diarySnapshots(
			items,
			destination.date,
			destination.meal,
			mintNutritionUuid,
		).map((entry) => (comboGroup ? { ...entry, comboGroup } : entry));
		return new Promise<void>((resolve, reject) =>
			operations.createBatch(
				subject,
				destination.date,
				destination.meal,
				entries,
				(error) => {
					lock.current = false;
					setLogging(false);
					toast.error(copy.logFailure);
					reject(error);
				},
				() => {
					lock.current = false;
					setLogging(false);
					if (draftId) void drafts.remove(draftId).catch(() => undefined);
					toast.success(
						fmt(copy.logged, {
							count: plural(locale, entries.length, copy.items),
							meal: t.nutrition.meals[destination.meal],
						}),
						{
							action: {
								label: t.nutrition.logFood.undo,
								onPress: () => {
									for (const entry of entries)
										operations.remove(
											subject,
											{ kind: "clientEntryId", id: entry.clientEntryId },
											undefined,
											() => toast.error(t.nutrition.logFood.undoFailure),
										);
								},
							},
						},
					);
					resolve();
					if (!comboGroup) close();
				},
			),
		);
	}

	function confirmReview(items: readonly ReviewItem[]) {
		if (saveAs === "items") {
			void logItems(items).catch(() => undefined);
			return;
		}
		if (saveAs === "combo") {
			setMakingCombo(true);
			return;
		}
		const names = items.map(
			(item) => item.food?.name[locale] ?? item.described,
		);
		authoring.request("oneOff", {
			name: names.join(", ").slice(0, 120),
			nutrients: combinedNutrients(items),
		});
		// Replacing one sheet with another leaves the new sheet empty on iOS:
		// close this one, then present the next. The One-off sits above Log
		// food, which turns its Recipe/Personal food switch into an editor.
		const params = { date: destination.date, meal: destination.meal };
		close();
		if (!fromFoodBrowser) router.push({ pathname: "/nutrition-food", params });
		router.push({
			pathname: "/nutrition-one-off",
			params: { ...params, ...(draftId ? { draftId } : {}) },
		});
	}

	let body: ReactNode;
	if (!session.ai.consented) {
		body = (
			<NutritionAiConsent
				onContinue={session.ai.grantConsent}
				onDecline={close}
			/>
		);
	} else if (phase.kind === "label") {
		// The editor takes over this sheet's header with its own ✕ and ✓.
		return (
			<PersonalFoodEditor
				seed={phase.draft}
				chrome="route"
				reviewNotice={{
					title: phase.checks.length
						? copy.checksTitle
						: copy.labelDetectedTitle,
					...(phase.checks.length
						? {
								attribution: phase.checks.map((check) => copy[check]).join(" "),
							}
						: {}),
				}}
				onCancel={session.edit}
				onSaved={(food) => {
					const [candidate] = buildAssistanceFoodCatalog([], [food]);
					const portion = food.servings[0]?.amount ?? 100;
					session.showItems(food.name[locale], [
						{
							key: "label-food",
							described: food.name[locale],
							amount: portion,
							unit: food.baseUnit === "ml" ? "ml" : "g",
							grams: portion,
							...(food.baseUnit === "ml" ? { ml: portion } : {}),
							amountLabel: food.servings[0]?.label[locale] ?? `${portion} g`,
							confidence: "medium",
							candidates: [candidate],
							food: candidate,
						},
					]);
				}}
			/>
		);
	} else if (phase.kind === "review" && makingCombo) {
		const parts = diarySnapshots(
			phase.items,
			destination.date,
			destination.meal,
			mintNutritionUuid,
		).map((entry) => comboPartFromEntry(entry));
		return (
			<>
				{/* The combo form brings its own title and ✓; drop this sheet's. */}
				<Stack.Screen
					options={{
						headerTitle: undefined,
						unstable_headerRightItems: undefined,
					}}
				/>
				<ComboNewScreen
					parts={parts}
					onCreated={(combo) =>
						logItems(phase.items, {
							id: mintNutritionUuid(),
							comboId: combo.id,
							name: combo.name,
						})
					}
					onSaved={() => close()}
				/>
			</>
		);
	} else if (phase.kind === "analysing") {
		body = (
			<View style={{ gap: spacing.md }}>
				<SeenCard photo={session.photo} label={copy.analysing} busy />
				<SkeletonGroup label={copy.analysing}>
					<SkeletonBlock height={52} />
					<SkeletonBlock height={52} />
				</SkeletonGroup>
				<PrimaryButton label={copy.cancel} onPress={session.cancel} />
			</View>
		);
	} else if (phase.kind === "review") {
		body = (
			<Review
				seen={phase.seen}
				photo={session.photo}
				items={phase.items}
				saveAs={saveAs}
				onSaveAs={setSaveAs}
				onEditInput={session.edit}
				onEditItem={setEditing}
			/>
		);
	} else {
		body = (
			<InputCard
				session={session}
				focusReady={presented}
				onCamera={() => setCamera(true)}
				onLibrary={async () => {
					const result = await ImagePicker.launchImageLibraryAsync({
						mediaTypes: ["images"],
						quality: 1,
						exif: false,
					});
					const uri = result.canceled ? undefined : result.assets[0]?.uri;
					if (uri) session.setPhoto(uri);
				}}
				onSaveNote={async () => {
					try {
						await drafts.create({
							date: destination.date,
							meal: destination.meal,
							note: session.text.trim(),
						});
						close();
					} catch {
						toast.error(t.nutrition.drafts.saveFailure);
					}
				}}
				onSearch={() => {
					close();
					router.push({
						pathname: "/nutrition-food",
						params: {
							date: destination.date,
							meal: destination.meal,
							query: session.text,
						},
					});
				}}
			/>
		);
	}

	const reviewItems = phase.kind === "review" ? phase.items : [];
	const cta =
		saveAs === "combo"
			? copy.makeCombo
			: saveAs === "one"
				? copy.continueOne
				: plural(locale, reviewItems.length, copy.logItems);

	return (
		<View
			// One stable child for the form sheet: its ScrollView sizing only
			// copes with a fixed subview order.
			collapsable={false}
			style={{ flex: 1, backgroundColor: colors.bg }}
		>
			<Stack.Screen options={options} />
			<DatePickerSheet
				visible={choosingDay}
				date={destination.date}
				today={today}
				locale={locale}
				title={t.nutrition.logFood.chooseDate}
				todayLabel={t.nutrition.logFood.today}
				doneLabel={t.nutrition.logFood.doneChoosingDate}
				closeLabel={t.nutrition.logFood.closeMenu}
				onSelect={(next) => {
					setDestination((d) => ({ ...d, date: next }));
					setChoosingDay(false);
				}}
				onClose={() => setChoosingDay(false)}
			/>
			<ScrollView
				style={{ flex: 1 }}
				contentInsetAdjustmentBehavior="automatic"
				automaticallyAdjustKeyboardInsets
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="interactive"
				contentContainerStyle={{
					padding: spacing.md,
					paddingBottom: spacing.xxl * 3,
					gap: spacing.xs,
				}}
			>
				{body}
			</ScrollView>
			{phase.kind === "review" && !makingCombo ? (
				<View style={{ padding: spacing.md, paddingBottom: spacing.xl }}>
					<PrimaryButton
						label={cta}
						size="lg"
						loading={logging}
						disabled={!readyToLog(reviewItems)}
						onPress={() => confirmReview(reviewItems)}
					/>
				</View>
			) : null}
			<AssistanceItemSheet
				item={editing}
				onClose={() => setEditing(undefined)}
				onChange={(next) =>
					session.setItems(
						reviewItems.map((item) => (item.key === next.key ? next : item)),
					)
				}
				onRemove={() => {
					const removed = editing;
					setEditing(undefined);
					const rest = reviewItems.filter((item) => item.key !== removed?.key);
					if (rest.length) session.setItems(rest);
					else session.edit();
				}}
			/>
			<Modal
				visible={camera}
				presentationStyle="fullScreen"
				animationType={modalAnimation(reduceMotion, "slide")}
				onRequestClose={() => setCamera(false)}
			>
				<FoodPhotoCamera
					mode="meal"
					onPhoto={(uri) => {
						setCamera(false);
						session.setPhoto(uri);
					}}
					onCancel={() => setCamera(false)}
				/>
			</Modal>
		</View>
	);
}

function SeenCard({
	photo,
	label,
	text,
	busy,
	onEdit,
}: {
	photo?: string;
	label: string;
	text?: string;
	busy?: boolean;
	onEdit?: () => void;
}) {
	const colors = useTokens();
	const { t } = useI18n();
	return (
		<FoodFormCard>
			<View
				style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.md }}
			>
				{photo ? (
					<Image
						source={{ uri: photo }}
						style={{ width: 48, height: 48, borderRadius: radius.sm }}
						accessibilityIgnoresInvertColors
					/>
				) : null}
				<View style={{ flex: 1, gap: 2 }}>
					<AppText variant="caption">{label}</AppText>
					{busy ? (
						<ActivityIndicator style={{ alignSelf: "flex-start" }} />
					) : (
						<AppText variant="secondary" style={{ color: colors.text }}>
							{text}
						</AppText>
					)}
				</View>
				{onEdit ? (
					<Pressable accessibilityRole="button" onPress={onEdit} hitSlop={8}>
						<AppText
							variant="secondary"
							style={{ color: colors.accent, fontWeight: "600" }}
						>
							{t.nutrition.assistance.change}
						</AppText>
					</Pressable>
				) : null}
			</View>
		</FoodFormCard>
	);
}

function InputCard({
	session,
	focusReady,
	onCamera,
	onLibrary,
	onSaveNote,
	onSearch,
}: {
	session: ReturnType<typeof useAssistanceSession>;
	/** The sheet has finished presenting, so focusing cannot misplace the scroll. */
	focusReady: boolean;
	onCamera: () => void;
	onLibrary: () => void;
	onSaveNote: () => void;
	onSearch: () => void;
}) {
	const { t } = useI18n();
	const copy = t.nutrition.assistance;
	const colors = useTokens();
	const problem =
		session.phase.kind === "input" ? session.phase.problem : undefined;
	const canAnalyse = Boolean(session.text.trim() || session.photo);
	const input = useRef<TextInputInstance | null>(null);
	const hasPhoto = useRef(Boolean(session.photo));
	hasPhoto.current = Boolean(session.photo);
	useEffect(() => {
		if (focusReady && !hasPhoto.current) input.current?.focus();
	}, [focusReady]);
	const pill = (
		label: string,
		symbol: { ios: SFSymbol; android: string },
		onPress: () => void,
	) => (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={{
				minHeight: 36,
				flexDirection: "row",
				alignItems: "center",
				gap: 6,
				paddingHorizontal: spacing.md,
				borderRadius: radius.pill,
				backgroundColor: colors.surface2,
			}}
		>
			<SymbolView
				name={{
					ios: symbol.ios,
					android: symbol.android as never,
					web: symbol.android as never,
				}}
				size={15}
				tintColor={colors.text}
			/>
			<AppText
				variant="footnote"
				style={{ color: colors.text, fontWeight: "600" }}
			>
				{label}
			</AppText>
		</Pressable>
	);
	const notice =
		problem === "noFood" ? (
			<Notice tone="warn" title={copy.noFoodTitle} body={copy.noFoodBody} />
		) : problem === "offline" ? (
			<Notice
				tone="warn"
				title={copy.offlineHelpTitle}
				body={copy.offlineHelpBody}
			/>
		) : problem === "limit" ? (
			<Notice
				tone="warn"
				title={fmt(copy.limitTitle, { count: 50 })}
				body={copy.limitBody}
			/>
		) : problem ? (
			<Notice tone="warn" title={copy[problem]} />
		) : null;
	return (
		<View style={{ gap: spacing.sm }}>
			{notice}
			<FoodFormCard>
				<View style={{ padding: spacing.md, gap: spacing.sm }}>
					{session.photo ? (
						<View style={{ flexDirection: "row" }}>
							<View>
								<Image
									source={{ uri: session.photo }}
									style={{ width: 72, height: 72, borderRadius: radius.md }}
									accessibilityIgnoresInvertColors
								/>
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={copy.removePhoto}
									onPress={() => session.setPhoto(undefined)}
									hitSlop={8}
									style={{
										position: "absolute",
										top: -6,
										right: -6,
										width: 24,
										height: 24,
										borderRadius: 12,
										alignItems: "center",
										justifyContent: "center",
										backgroundColor: colors.text,
									}}
								>
									<SymbolView
										name={{ ios: "xmark", android: "close", web: "close" }}
										size={11}
										weight="bold"
										tintColor={colors.bg}
									/>
								</Pressable>
							</View>
						</View>
					) : null}
					<TextInput
						ref={input}
						accessibilityLabel={copy.title}
						value={session.text}
						onChangeText={session.setText}
						placeholder={
							session.photo ? copy.photoPlaceholder : copy.placeholder
						}
						placeholderTextColor={colors.textFaint}
						multiline
						maxLength={2000}
						style={{ ...type.body, color: colors.text, minHeight: 80 }}
					/>
					<View
						style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}
					>
						{pill(
							copy.camera,
							{ ios: "camera", android: "photo_camera" },
							onCamera,
						)}
						{pill(copy.library, { ios: "photo", android: "image" }, onLibrary)}
						{problem === "limit"
							? pill(
									t.nutrition.drafts.saveAsNote,
									{ ios: "note.text", android: "note" },
									onSaveNote,
								)
							: null}
						{problem === "limit"
							? pill(
									copy.searchInstead,
									{ ios: "magnifyingglass", android: "search" },
									onSearch,
								)
							: null}
					</View>
				</View>
			</FoodFormCard>
			<AppText variant="caption" style={{ paddingHorizontal: spacing.xs }}>
				{copy.photoHint}
			</AppText>
			<PrimaryButton
				label={copy.analyse}
				disabled={!canAnalyse || problem === "limit"}
				onPress={() => void session.analyse()}
			/>
		</View>
	);
}

function Review({
	seen,
	photo,
	items,
	saveAs,
	onSaveAs,
	onEditInput,
	onEditItem,
}: {
	seen: string;
	photo?: string;
	items: readonly ReviewItem[];
	saveAs: SaveAs;
	onSaveAs: (value: SaveAs) => void;
	onEditInput: () => void;
	onEditItem: (item: ReviewItem) => void;
}) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.assistance;
	const colors = useTokens();
	const totals = reviewTotals(items);
	const estimated = items.filter((item) => !item.food).length;
	const saveAsLabels: Record<SaveAs, string> = {
		items: copy.saveAsItems,
		combo: copy.saveAsCombo,
		one: copy.saveAsOne,
	};
	return (
		<View style={{ gap: spacing.xs }}>
			<SeenCard
				photo={photo}
				label={photo ? copy.seenPhoto : copy.seenText}
				text={seen}
				onEdit={onEditInput}
			/>
			{estimated ? (
				<View style={{ marginTop: spacing.sm }}>
					<Notice
						tone="warn"
						title={plural(locale, estimated, copy.estimatedTitle)}
						body={copy.estimatedBody}
					/>
				</View>
			) : null}
			<FoodFormSectionHeader title={plural(locale, items.length, copy.items)} />
			<FoodFormCard>
				{items.map((item, index) => {
					const energy = itemNutrients(item)?.energy;
					const kcal =
						energy?.kind === "value"
							? String(roundForDisplay("energy", energy.amount))
							: "—";
					const uncertain = !item.food || item.confidence === "low";
					const name = item.food?.name[locale] ?? item.described;
					const value = itemNutrients(item)
						? `${uncertain ? "~ " : ""}${item.amountLabel} · ${kcal} kcal`
						: copy.unmatched;
					return (
						<Pressable
							key={item.key}
							accessibilityRole="button"
							accessibilityLabel={fmt(copy.row, {
								name,
								amount: item.amountLabel,
								kcal,
							})}
							onPress={() => onEditItem(item)}
							style={{
								minHeight: 50,
								flexDirection: "row",
								alignItems: "center",
								gap: spacing.sm,
								paddingHorizontal: spacing.md,
								borderTopWidth: index ? 0.5 : 0,
								borderTopColor: colors.separator,
							}}
						>
							<AppText
								variant="secondary"
								style={{
									flex: 1,
									// Large text: the name keeps room and both sides wrap.
									minWidth: "45%",
									color: colors.text,
									paddingVertical: spacing.sm,
								}}
							>
								{name}
							</AppText>
							<AppText
								variant="secondary"
								style={{
									flexShrink: 1,
									textAlign: "right",
									color: uncertain ? colors.warn : colors.textMuted,
									fontVariant: ["tabular-nums"],
								}}
							>
								{value}
							</AppText>
							<SymbolView
								name={{
									ios: "chevron.right",
									android: "chevron_right",
									web: "chevron_right",
								}}
								size={12}
								tintColor={colors.textFaint}
							/>
						</Pressable>
					);
				})}
			</FoodFormCard>
			<FoodFormSectionHeader title={copy.total} />
			<FoodFormCard>
				{(["energy", "protein", "carbs", "fat"] as const).map((key, index) => (
					<View
						key={key}
						style={{
							minHeight: 48,
							flexDirection: "row",
							alignItems: "center",
							paddingHorizontal: spacing.md,
							borderTopWidth: index ? 0.5 : 0,
							borderTopColor: colors.separator,
						}}
					>
						<AppText
							variant="secondary"
							style={{ flex: 1, color: colors.text }}
						>
							{t.nutrition.nutrients[key]}
						</AppText>
						<AppText
							variant="secondary"
							style={{
								color: colors.text,
								fontWeight: "700",
								fontVariant: ["tabular-nums"],
							}}
						>
							{
								// Unknown is never shown as zero: "—" when no item has the
								// figure, and the known part marked incomplete otherwise.
								totals[key].known === 0
									? "—"
									: `${roundForDisplay(key, totals[key].amount).toLocaleString(locale)} ${key === "energy" ? "kcal" : "g"}${totals[key].missing ? ` · ${copy.incomplete}` : ""}`
							}
						</AppText>
					</View>
				))}
			</FoodFormCard>
			<View style={{ marginTop: spacing.md }}>
				<FoodFormCard>
					<View
						style={{
							minHeight: 50,
							flexDirection: "row",
							alignItems: "center",
							paddingHorizontal: spacing.md,
						}}
					>
						<AppText
							variant="secondary"
							style={{ flex: 1, color: colors.text }}
						>
							{copy.saveAs}
						</AppText>
						<NutritionChoiceMenu
							accessibilityLabel={copy.saveAs}
							sections={[
								(["items", "combo", "one"] as const).map((id) => ({
									id,
									label: saveAsLabels[id],
									hint:
										id === "items"
											? copy.saveAsItemsHint
											: id === "combo"
												? copy.saveAsComboHint
												: copy.saveAsOneHint,
									selected: saveAs === id,
								})),
							]}
							onSelect={(id) => onSaveAs(id as SaveAs)}
						>
							<FoodFormMenuValue label={saveAsLabels[saveAs]} />
						</NutritionChoiceMenu>
					</View>
				</FoodFormCard>
			</View>
			<AppText
				variant="caption"
				style={{
					paddingHorizontal: spacing.xs,
					textAlign: "center",
					marginTop: spacing.sm,
				}}
			>
				{copy.footer}
			</AppText>
			<AppText
				variant="caption"
				style={{ paddingHorizontal: spacing.xs, textAlign: "center" }}
			>
				{nevoAttribution(
					items.every((item) => item.food?.provenance.source === "shipped"),
				)}
			</AppText>
		</View>
	);
}
