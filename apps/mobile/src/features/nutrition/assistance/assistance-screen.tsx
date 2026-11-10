import { nevoAttribution, roundForDisplay } from "@foundry/core";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackNavigationOptions } from "expo-router";
import { Stack, useNavigation, usePreventRemove, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Modal,
	Pressable,
	ScrollView,
	Switch,
	TextInput,
	View,
} from "react-native";
import { todayIsoDate } from "../../../data/calendar-day";
import { useFoodAuthoringIntent } from "../../../data/food-authoring-intent";
import {
	combinedNutrients,
	diarySnapshots,
	isUncertain,
	itemNutrients,
	oneEntrySnapshot,
	preparationCaption,
	type ReviewItem,
	readyToLog,
	reviewTotals,
} from "../../../data/nutrition-ai";
import {
	forgetAiSession,
	readAiSession,
	saveAiSession,
	sessionUnchanged,
} from "../../../data/nutrition-ai-history";
import { buildAssistanceFoodCatalog } from "../../../data/nutrition-assistance";
import { type MealSlot, useNutritionDay } from "../../../data/nutrition-day";
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
import { TextAction } from "../../../ui/form";
import type { SFSymbol } from "../../../ui/inset-list.types";
import { SkeletonBlock, SkeletonGroup } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { type AcceptedCombo, ComboNewScreen } from "../combo/combo-new-screen";
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
import {
	ANSWER_MARK,
	type AssistanceProblem,
	useAssistanceSession,
} from "./use-assistance-session";

const LOG_SLOW_MS = 20_000;

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
	resume,
}: {
	date: string;
	meal: MealSlot;
	text?: string;
	/** The Capture Draft being processed; removed once its food is logged. */
	draftId?: string;
	/** Opened from Log food, which is then the screen beneath this sheet. */
	fromFoodBrowser?: boolean;
	/** A saved session to continue; logging replaces what it logged. */
	resume?: string;
}) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.assistance;
	const colors = useTokens();
	const router = useRouter();
	const toast = useToast();
	const reduceMotion = useReduceMotion();
	const operations = useNutritionOperations();
	const authoring = useFoodAuthoringIntent();
	const [resumed] = useState(() => (resume ? readAiSession(resume) : null));
	const session = useAssistanceSession(initialText, resumed ?? undefined);
	const replacedDay = useNutritionDay(resumed?.entries[0]?.date ?? initialDate);
	// A correction typed but not sent counts as much as one that was.
	const [unsentCorrection, setUnsentCorrection] = useState(false);
	// Continuing must compare with the diary, so it waits for the diary.
	const dayPending = Boolean(resumed) && replacedDay.status !== "ready";
	const createdForReplace = useRef<readonly string[] | null>(
		resumed?.stranded ?? null,
	);
	const unsaved = session.touched || session.inputChanged || unsentCorrection;
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
	const acceptedCombo = useRef<AcceptedCombo | undefined>(undefined);
	const lock = useRef(false);
	// A choice the person made themselves survives corrections.
	const chosenSaveAs = useRef(false);
	const destinationMenu = useMealDestinationMenu({
		date: destination.date,
		meal: destination.meal,
		today,
		onSelectMeal: (meal) => setDestination((d) => ({ ...d, meal })),
		onOtherDay: () => setChoosingDay(true),
	});
	const navigation = useNavigation();
	// Set by every way out the person chose; the guard below is for the others.
	const leaving = useRef(false);
	const close = () => {
		leaving.current = true;
		return router.canGoBack()
			? router.back()
			: router.replace({
					pathname: "/nutrition",
					params: { date: destination.date },
				});
	};
	// What was corrected by hand is not thrown away by one stray tap.
	const requestClose = () => {
		if (logging) {
			leaveWhileSaving(close);
			return;
		}
		// The combo form was one step on from this review: back to it.
		if (makingCombo) {
			setMakingCombo(false);
			return;
		}
		if (!unsaved) {
			close();
			return;
		}
		Alert.alert(copy.discardTitle, undefined, [
			{ text: copy.discardKeep, style: "cancel" },
			{ text: copy.discardConfirm, style: "destructive", onPress: close },
		]);
	};
	// Coming back and logging again would log it twice: leaving is a choice.
	const leaveWhileSaving = (leave: () => void) =>
		Alert.alert(copy.savingTitle, copy.savingBody, [
			{ text: copy.savingStay, style: "cancel" },
			{ text: copy.savingLeave, onPress: leave },
		]);
	// The hardware back button and anything else that removes this screen.
	usePreventRemove(unsaved || logging, ({ data }) => {
		if (leaving.current) {
			navigation.dispatch(data.action);
			return;
		}
		if (logging) {
			leaveWhileSaving(() => {
				leaving.current = true;
				navigation.dispatch(data.action);
			});
			return;
		}
		Alert.alert(copy.discardTitle, undefined, [
			{ text: copy.discardKeep, style: "cancel" },
			{
				text: copy.discardConfirm,
				style: "destructive",
				onPress: () => {
					leaving.current = true;
					navigation.dispatch(data.action);
				},
			},
		]);
	});
	const closeRef = useRef(requestClose);
	closeRef.current = requestClose;
	const menuRef = useRef(destinationMenu.menu);
	menuRef.current = destinationMenu.menu;
	const menu = destinationMenu.menu;
	// biome-ignore lint/correctness/useExhaustiveDependencies: handlers and the menu come from refs
	const options = useMemo(
		(): NativeStackNavigationOptions => ({
			title: copy.title,
			headerShown: true,
			// A transparent header never insets this sheet's scroll view, which
			// left the text field under it; an opaque one lays out below it.
			headerTransparent: false,
			gestureEnabled: !unsaved,
			headerStyle: { backgroundColor: colors.bg },
			headerShadowVisible: false,
			// Clears what the label editor put on the right while it owned the header.
			unstable_headerRightItems: () => [],
			// The same for the combo form's ✓.
			headerRight: undefined,
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
		[
			copy,
			colors.bg,
			colors.text,
			menu.label,
			menu.dayLabel,
			menu.mealName,
			unsaved,
		],
	);

	const { phase, mealStarts } = session;
	// A combo saved for the last meal is not this one's to overwrite.
	useEffect(() => {
		if (mealStarts > 0) acceptedCombo.current = undefined;
	}, [mealStarts]);
	// Each new AI result picks a fitting default; edits to it do not.
	const analysis = phase.kind === "review" ? phase.analysis : undefined;
	// biome-ignore lint/correctness/useExhaustiveDependencies: only when a new analysis lands
	useEffect(() => {
		if (
			phase.kind === "review" &&
			analysis !== undefined &&
			!chosenSaveAs.current
		)
			setSaveAs(defaultSaveAs(phase.items));
	}, [analysis]);

	function logItems(
		items: readonly ReviewItem[],
		comboGroup?: {
			id: string;
			comboId: string;
			name: string;
		},
	) {
		return logEntries(
			diarySnapshots(
				items,
				destination.date,
				destination.meal,
				mintNutritionUuid,
			).map((entry) => (comboGroup ? { ...entry, comboGroup } : entry)),
			Boolean(comboGroup),
		);
	}

	function logEntries(
		entries: ReturnType<typeof diarySnapshots>,
		stayOpen = false,
	) {
		const subject = operations.getSubject();
		if (lock.current || !subject) return Promise.resolve(false);
		// Replacing what was edited since would lose that edit.
		if (resumed && replacedDay.status !== "ready")
			return Promise.resolve(false);
		if (
			resumed &&
			replacedDay.status === "ready" &&
			!sessionUnchanged(resumed, replacedDay.day)
		) {
			toast.error(copy.replaceStale);
			return Promise.resolve(false);
		}
		const context = session.context();
		lock.current = true;
		setLogging(true);
		// A save without a connection waits for one: say so rather than just spin.
		const slow = setTimeout(() => toast.error(copy.logSlow), LOG_SLOW_MS);
		const finish = () => {
			clearTimeout(slow);
			lock.current = false;
			setLogging(false);
		};
		return new Promise<boolean>((resolve, reject) => {
			const failed = (error: unknown) => {
				finish();
				toast.error(session.ai.online ? copy.logFailure : copy.logOffline);
				reject(error);
			};
			const done = (saved: readonly string[]) => {
				finish();
				createdForReplace.current = null;
				if (draftId) void drafts.remove(draftId).catch(() => undefined);
				if (resumed) forgetAiSession(resumed);
				const forgetAnswer = session.rememberLogged();
				const logged = context
					? {
							id: mintNutritionUuid(),
							...context,
							entryIds: saved,
							// A retry keeps the ids of its first try.
							entries: entries.map((entry, index) => ({
								...entry,
								clientEntryId: saved[index] ?? entry.clientEntryId,
							})),
						}
					: null;
				if (logged) saveAiSession(logged, subject);
				// A continued meal gets its entries back once these are gone.
				const undo = () =>
					removeAll(
						subject,
						saved,
						() =>
							toast.error(t.nutrition.logFood.undoFailure, {
								action: { label: copy.tryAgain, onPress: undo },
							}),
						() => {
							forgetAnswer();
							if (logged) forgetAiSession(logged);
							if (resumed) restoreReplaced(subject, resumed);
						},
					);
				toast.success(
					fmt(copy.logged, {
						count: plural(locale, entries.length, copy.items),
						meal: t.nutrition.meals[destination.meal],
					}),
					{
						action: {
							label: t.nutrition.logFood.undo,
							onPress: undo,
						},
					},
				);
				resolve(true);
				if (!stayOpen && !leaving.current) close();
			};
			// Continued meal: all of it goes, in one step, or the new entries do. An
			// attempt that could not be taken back goes with it, so what is logged
			// is always the review on screen now.
			const replace = (saved: readonly string[], ids: readonly string[]) =>
				removeAll(
					subject,
					[...ids, ...(createdForReplace.current ?? [])],
					() =>
						removeAll(
							subject,
							saved,
							() => {
								createdForReplace.current = [
									...(createdForReplace.current ?? []),
									...saved,
								];
								// Kept with the session, so reopening can still clean them up.
								if (resumed)
									saveAiSession(
										{ ...resumed, stranded: createdForReplace.current },
										subject,
									);
								finish();
								toast.error(copy.replaceBoth);
								resolve(false);
							},
							() => {
								finish();
								toast.error(copy.replaceFailure);
								resolve(false);
							},
						),
					() => done(saved),
				);
			try {
				operations.createBatch(
					subject,
					destination.date,
					destination.meal,
					entries,
					failed,
					(saved) => {
						if (resumed) replace(saved, resumed.entryIds);
						else done(saved);
					},
				);
			} catch (error) {
				failed(error);
			}
		});
	}

	/** One operation, so it happens completely or not at all. */
	function removeAll(
		subject: string,
		ids: readonly string[],
		onError: () => void,
		onSuccess: () => void,
	) {
		try {
			operations.removeBatch(
				subject,
				ids.map((id) => ({ kind: "clientEntryId" as const, id })),
				onError,
				onSuccess,
			);
		} catch {
			onError();
		}
	}

	function restoreReplaced(
		subject: string,
		replaced: NonNullable<typeof resumed>,
	) {
		const [first] = replaced.entries;
		if (!first) return;
		const entries = replaced.entries.map((entry) => ({
			...entry,
			clientEntryId: mintNutritionUuid(),
		}));
		try {
			operations.createBatch(
				subject,
				first.date,
				first.meal,
				entries,
				() => undoRestoreFailed(subject, replaced),
				(saved) =>
					saveAiSession(
						{
							...replaced,
							id: mintNutritionUuid(),
							// A retry keeps the ids of its first try.
							entries: entries.map((entry, index) => ({
								...entry,
								clientEntryId: saved[index] ?? entry.clientEntryId,
							})),
							entryIds: saved,
						},
						subject,
					),
			);
		} catch {
			undoRestoreFailed(subject, replaced);
		}
	}

	/** The replaced meal lives only in this closure now: keep offering it. */
	function undoRestoreFailed(
		subject: string,
		replaced: NonNullable<typeof resumed>,
	) {
		toast.error(t.nutrition.logFood.undoFailure, {
			action: {
				label: copy.tryAgain,
				onPress: () => restoreReplaced(subject, replaced),
			},
		});
	}

	/**
	 * The AI's title ("Broodje pittige kip") names one product or meal better
	 * than its parts.
	 */
	function oneItemName(items: readonly ReviewItem[]) {
		const names = items.map(
			(item) => item.food?.name[locale] ?? item.described,
		);
		const title = phase.kind === "review" ? phase.title?.trim() : undefined;
		return (title || names.join(", ")).slice(0, 120);
	}

	function confirmReview(items: readonly ReviewItem[]) {
		// One matched food is one entry either way, and keeps its food reference.
		if (saveAs === "items" || (items.length === 1 && items[0]?.food)) {
			void logItems(items).catch(() => undefined);
			return;
		}
		if (saveAs === "combo") {
			setMakingCombo(true);
			return;
		}
		void logEntries([
			oneEntrySnapshot(
				items,
				oneItemName(items),
				destination.date,
				destination.meal,
				mintNutritionUuid(),
			),
		]).catch(() => undefined);
	}

	/** The form for one item: its values, a recipe, or keeping it as a Food. */
	function adjustOneItem(items: readonly ReviewItem[]) {
		authoring.request("oneOff", {
			name: oneItemName(items),
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
					acceptedRef={acceptedCombo}
					// The combo form stays open when the meal was not logged; logging
					// has said why.
					onCreated={(combo) =>
						logItems(phase.items, {
							id: mintNutritionUuid(),
							comboId: combo.id,
							name: combo.name,
						}).catch(() => false)
					}
					onSaved={() => close()}
				/>
			</>
		);
	} else if (phase.kind === "analysing") {
		const stepLabel = {
			web: copy.stepWeb,
			reading: copy.stepReading,
			matching: copy.stepMatching,
		}[phase.step];
		body = (
			<View style={{ gap: spacing.md }}>
				<AnalysingCard
					photo={session.photo}
					label={stepLabel}
					text={session.text}
				/>
				<SkeletonGroup label={stepLabel}>
					<SkeletonBlock height={52} />
					<SkeletonBlock height={52} />
				</SkeletonGroup>
				<View style={{ alignItems: "center" }}>
					<TextAction label={copy.cancel} onPress={session.cancel} />
				</View>
			</View>
		);
	} else if (phase.kind === "review") {
		body = (
			<Review
				seen={phase.seen}
				photo={session.photo}
				items={phase.items}
				question={phase.question ?? null}
				sources={phase.sources ?? []}
				replacing={resumed?.entryIds.length ?? 0}
				problem={phase.problem}
				detail={phase.detail}
				canRefine={phase.analysis !== undefined}
				followUps={session.followUps}
				refining={session.refining}
				onRefine={(followUp) => void session.refine(followUp)}
				onUnsentCorrection={setUnsentCorrection}
				saveAs={saveAs}
				onSaveAs={(value) => {
					chosenSaveAs.current = true;
					setSaveAs(value);
				}}
				onEditInput={session.edit}
				onEditItem={setEditing}
			/>
		);
	} else {
		body = (
			<InputCard
				session={session}
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
				? copy.logOne
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
				<View
					style={{
						padding: spacing.md,
						paddingBottom: spacing.xl,
						gap: spacing.xs,
					}}
				>
					<PrimaryButton
						label={cta}
						size="lg"
						loading={logging}
						disabled={
							!readyToLog(reviewItems) ||
							session.refining ||
							dayPending ||
							unsentCorrection
						}
						onPress={() => confirmReview(reviewItems)}
					/>
					{unsentCorrection ? (
						<AppText variant="secondary" style={{ textAlign: "center" }}>
							{copy.sendCorrectionFirst}
						</AppText>
					) : null}
					{dayPending ? (
						<AppText variant="secondary" style={{ textAlign: "center" }}>
							{session.ai.online ? copy.dayLoading : copy.dayOffline}
						</AppText>
					) : null}
					{saveAs === "one" && !resumed ? (
						<View style={{ alignItems: "center" }}>
							<TextAction
								label={copy.adjustOne}
								disabled={
									!readyToLog(reviewItems) ||
									session.refining ||
									logging ||
									dayPending ||
									unsentCorrection
								}
								onPress={() => adjustOneItem(reviewItems)}
							/>
						</View>
					) : null}
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

/** While the AI works: what it is working on, what it is doing, for how long. */
function AnalysingCard({
	photo,
	label,
	text,
}: {
	photo?: string;
	label: string;
	text: string;
}) {
	const [seconds, setSeconds] = useState(0);
	useEffect(() => {
		const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
		return () => clearInterval(timer);
	}, []);
	return (
		<SeenCard
			photo={photo}
			label={seconds >= 2 ? `${label} ${seconds} s` : label}
			text={text.trim() || undefined}
			busy
		/>
	);
}

function RefiningRow({ label }: { label: string }) {
	const [seconds, setSeconds] = useState(0);
	useEffect(() => {
		const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
		return () => clearInterval(timer);
	}, []);
	return (
		<View
			style={{
				flexDirection: "row",
				gap: spacing.sm,
				alignItems: "center",
				padding: spacing.sm,
			}}
		>
			<ActivityIndicator />
			<AppText variant="caption">
				{seconds >= 2 ? `${label} ${seconds} s` : label}
			</AppText>
		</View>
	);
}

function SeenCard({
	photo,
	label,
	text,
	busy,
	onEdit,
	followUps = [],
}: {
	photo?: string;
	label: string;
	text?: string;
	busy?: boolean;
	onEdit?: () => void;
	/** Corrections already applied, shown under the description. */
	followUps?: readonly string[];
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
					{text ? (
						<AppText variant="secondary" style={{ color: colors.text }}>
							{text}
						</AppText>
					) : null}
					{busy ? (
						<ActivityIndicator
							style={{ alignSelf: "flex-start", marginTop: spacing.xs }}
						/>
					) : null}
					{followUps.map((followUp, index) => (
						<View
							// biome-ignore lint/suspicious/noArrayIndexKey: an append-only trail
							key={index}
							style={{
								alignSelf: "flex-end",
								maxWidth: "90%",
								marginTop: spacing.xs,
								paddingHorizontal: spacing.sm,
								paddingVertical: 6,
								borderRadius: radius.md,
								backgroundColor: colors.accentDim,
							}}
						>
							<AppText variant="footnote" style={{ color: colors.text }}>
								{followUp.split(ANSWER_MARK).pop()}
							</AppText>
						</View>
					))}
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
	onCamera,
	onLibrary,
	onSaveNote,
	onSearch,
}: {
	session: ReturnType<typeof useAssistanceSession>;
	onCamera: () => void;
	onLibrary: () => void;
	onSaveNote: () => void;
	onSearch: () => void;
}) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.assistance;
	const colors = useTokens();
	const problem =
		session.phase.kind === "input" ? session.phase.problem : undefined;
	const detail =
		session.phase.kind === "input" ? session.phase.detail : undefined;
	const repeat = session.repeat;
	const repeatKcal = repeat ? reviewTotals(repeat.items).energy.amount : 0;
	const canAnalyse = Boolean(session.text.trim() || session.photo);
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
			<Notice
				tone="warn"
				title={copy.noFoodTitle}
				body={detail || copy.noFoodBody}
			/>
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
						accessibilityLabel={copy.title}
						value={session.text}
						onChangeText={session.setText}
						placeholder={
							session.photo ? copy.photoPlaceholder : copy.placeholder
						}
						placeholderTextColor={colors.textFaint}
						multiline
						autoFocus={!session.photo}
						maxLength={2000}
						submitBehavior="blurAndSubmit"
						returnKeyType="go"
						onSubmitEditing={() => {
							if (canAnalyse && problem !== "limit") void session.analyse();
						}}
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
						{problem && problem !== "noFood" && session.text.trim()
							? pill(
									t.nutrition.drafts.saveAsNote,
									{ ios: "note.text", android: "note" },
									onSaveNote,
								)
							: null}
						{problem && problem !== "noFood" && session.text.trim()
							? pill(
									copy.searchInstead,
									{ ios: "magnifyingglass", android: "search" },
									onSearch,
								)
							: null}
					</View>
				</View>
				<View
					style={{
						minHeight: 48,
						flexDirection: "row",
						alignItems: "center",
						gap: spacing.sm,
						paddingHorizontal: spacing.md,
						borderTopWidth: 0.5,
						borderTopColor: colors.separator,
					}}
				>
					<AppText variant="secondary" style={{ flex: 1, color: colors.text }}>
						{copy.webSearch}
					</AppText>
					<Switch
						accessibilityLabel={copy.webSearch}
						value={session.webSearch}
						onValueChange={session.setWebSearch}
						trackColor={{ true: colors.accentFill }}
					/>
				</View>
			</FoodFormCard>
			<AppText variant="caption" style={{ paddingHorizontal: spacing.xs }}>
				{copy.photoHint}
			</AppText>
			{repeat ? (
				<FoodFormCard>
					<Pressable
						accessibilityRole="button"
						onPress={session.applyRepeat}
						style={{ minHeight: 50, padding: spacing.md, gap: 2 }}
					>
						<AppText variant="caption">{copy.repeatTitle}</AppText>
						<AppText
							variant="secondary"
							style={{ color: colors.accent, fontWeight: "600" }}
						>
							{fmt(copy.repeatAction, {
								items: plural(locale, repeat.items.length, copy.items),
								kcal: String(roundForDisplay("energy", repeatKcal)),
							})}
						</AppText>
					</Pressable>
				</FoodFormCard>
			) : null}
			<PrimaryButton
				label={copy.analyse}
				disabled={!canAnalyse || problem === "limit"}
				onPress={() => void session.analyse()}
			/>
			{session.canGoBackToReview ? (
				<View style={{ alignItems: "center" }}>
					<TextAction
						label={copy.backToResult}
						onPress={session.backToReview}
					/>
				</View>
			) : null}
		</View>
	);
}

/**
 * One item when there is nothing to split: a single result, or nothing that
 * matched the food database (a store product, or only estimates).
 */
function defaultSaveAs(items: readonly ReviewItem[]): SaveAs {
	return items.length <= 1 ||
		!items.some((item) => item.food?.kind === "shipped")
		? "one"
		: "items";
}

/** "https://www.spar.nl/…" → "spar.nl". */
function siteOf(url: string) {
	return (url.match(/^https?:\/\/([^/]+)/)?.[1] ?? url).replace(/^www\./, "");
}

function Review({
	seen,
	photo,
	items,
	question,
	sources,
	replacing,
	problem,
	detail,
	canRefine,
	followUps,
	refining,
	onRefine,
	onUnsentCorrection,
	saveAs,
	onSaveAs,
	onEditInput,
	onEditItem,
}: {
	seen: string;
	photo?: string;
	items: readonly ReviewItem[];
	question: { text: string; options: readonly string[] } | null;
	sources: readonly { title: string; url: string }[];
	/** Entries logged earlier that logging this replaces. */
	replacing: number;
	problem?: AssistanceProblem;
	detail?: string;
	canRefine: boolean;
	followUps: readonly string[];
	refining: boolean;
	onRefine: (followUp: string) => void;
	onUnsentCorrection: (unsent: boolean) => void;
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
	// One question per meal: an answered one, however it is reworded next, or a
	// new one on top of it, would make logging a conversation.
	const openQuestion =
		question && !followUps.some((followUp) => followUp.includes(ANSWER_MARK));
	// Estimates and an unanswered question both mean the total can still move.
	const approximate = Boolean(openQuestion) || items.some(isUncertain);
	return (
		<View style={{ gap: spacing.xs }}>
			<SeenCard
				photo={photo}
				label={photo ? copy.seenPhoto : copy.seenText}
				text={seen}
				onEdit={onEditInput}
				followUps={followUps}
			/>
			{replacing ? (
				<AppText variant="caption" style={{ paddingHorizontal: spacing.xs }}>
					{fmt(copy.replacesLogged, {
						count: plural(locale, replacing, copy.items),
					})}
				</AppText>
			) : null}
			{sources.length ? (
				<AppText
					variant="caption"
					style={{ paddingHorizontal: spacing.xs }}
					numberOfLines={2}
				>
					{fmt(copy.webSources, {
						sites: [...new Set(sources.map((source) => siteOf(source.url)))]
							.slice(0, 3)
							.join(", "),
					})}
				</AppText>
			) : null}
			{refining ? <RefiningRow label={copy.refining} /> : null}
			{problem ? (
				<View style={{ marginTop: spacing.sm }}>
					<Notice
						tone="warn"
						title={
							problem === "offline"
								? copy.offlineHelpTitle
								: problem === "limit"
									? fmt(copy.limitTitle, { count: 50 })
									: problem === "noFood"
										? copy.noFoodTitle
										: copy[problem]
						}
						body={
							problem === "noFood"
								? detail || copy.noFoodBody
								: problem === "offline"
									? copy.offlineHelpBody
									: problem === "limit"
										? copy.limitBody
										: undefined
						}
					/>
				</View>
			) : null}
			{question && openQuestion && !refining ? (
				<View style={{ marginTop: spacing.sm }}>
					<FoodFormCard>
						<View style={{ padding: spacing.md, gap: spacing.sm }}>
							<AppText variant="caption" style={{ color: colors.accent }}>
								{copy.question}
							</AppText>
							<AppText variant="secondary" style={{ color: colors.text }}>
								{question.text}
							</AppText>
							<View
								style={{
									flexDirection: "row",
									flexWrap: "wrap",
									gap: spacing.sm,
								}}
							>
								{question.options.map((option) => (
									<Pressable
										key={option}
										accessibilityRole="button"
										onPress={() =>
											onRefine(`${question.text}${ANSWER_MARK}${option}`)
										}
										style={{
											minHeight: 36,
											justifyContent: "center",
											paddingHorizontal: spacing.md,
											borderRadius: radius.pill,
											backgroundColor: colors.surface2,
										}}
									>
										<AppText
											variant="footnote"
											style={{ color: colors.text, fontWeight: "600" }}
										>
											{option}
										</AppText>
									</Pressable>
								))}
							</View>
						</View>
					</FoodFormCard>
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
					const uncertain = isUncertain(item);
					const measured = /\d\s*(g|ml)\b/i.test(item.amountLabel)
						? undefined
						: `${Math.round(item.amount)} ${item.unit}`;
					const name = item.food?.name[locale] ?? item.described;
					const preparation = preparationCaption(item, locale);
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
							disabled={refining}
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
							<View
								style={{
									flex: 1,
									// Large text: the name keeps room and both sides wrap.
									minWidth: "45%",
									paddingVertical: spacing.sm,
								}}
							>
								<AppText variant="secondary" style={{ color: colors.text }}>
									{name}
								</AppText>
								{!item.food && item.components?.length ? (
									<AppText variant="caption">
										{item.components.map((part) => part.name).join(" · ")}
									</AppText>
								) : null}
								{preparation ? (
									<AppText variant="caption">{preparation}</AppText>
								) : null}
								{measured ? (
									<AppText variant="caption">{measured}</AppText>
								) : null}
							</View>
							<AppText
								variant="secondary"
								style={{
									flexShrink: 1,
									textAlign: "right",
									color: itemNutrients(item) ? colors.textMuted : colors.warn,
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
			{estimated ? (
				<AppText
					variant="caption"
					style={{ paddingHorizontal: spacing.xs, marginTop: spacing.xs }}
				>
					{plural(locale, estimated, copy.estimatedNote)}
				</AppText>
			) : null}
			{canRefine ? (
				<RefineField
					disabled={refining}
					sent={followUps.length}
					onSend={onRefine}
					onChange={onUnsentCorrection}
				/>
			) : null}
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
									: `${approximate ? "~ " : ""}${roundForDisplay(key, totals[key].amount).toLocaleString(locale)} ${key === "energy" ? "kcal" : "g"}${totals[key].missing ? ` · ${copy.incomplete}` : ""}`
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

/** A free correction on top of the review: “geen ui”, “groot broodje”. */
function RefineField({
	disabled,
	sent,
	onSend,
	onChange,
}: {
	disabled: boolean;
	/** How many corrections landed; the text only clears when one did. */
	sent: number;
	onSend: (followUp: string) => void;
	onChange: (unsent: boolean) => void;
}) {
	const { t } = useI18n();
	const copy = t.nutrition.assistance;
	const colors = useTokens();
	const [value, setValue] = useState("");
	const ready = Boolean(value.trim()) && !disabled;
	// biome-ignore lint/correctness/useExhaustiveDependencies: clears per landed correction
	useEffect(() => setValue(""), [sent]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: the handler is stable in effect
	useEffect(() => onChange(Boolean(value.trim())), [value]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: on leaving only
	useEffect(() => () => onChange(false), []);
	const send = () => {
		if (ready) onSend(value.trim());
	};
	return (
		<View style={{ marginTop: spacing.sm }}>
			<FoodFormCard>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing.sm,
						paddingLeft: spacing.md,
						paddingRight: spacing.xs,
						minHeight: 50,
					}}
				>
					<TextInput
						accessibilityLabel={copy.refinePlaceholder}
						value={value}
						onChangeText={setValue}
						placeholder={copy.refinePlaceholder}
						placeholderTextColor={colors.textFaint}
						returnKeyType="send"
						onSubmitEditing={send}
						editable={!disabled}
						maxLength={500}
						style={{ ...type.body, flex: 1, color: colors.text }}
					/>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={copy.refineSend}
						accessibilityState={{ disabled: !ready }}
						onPress={send}
						style={{
							width: 44,
							height: 44,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<View
							style={{
								width: 32,
								height: 32,
								borderRadius: 16,
								alignItems: "center",
								justifyContent: "center",
								backgroundColor: ready ? colors.accent : colors.surface2,
							}}
						>
							<SymbolView
								name={{
									ios: "arrow.up",
									android: "arrow_upward",
									web: "arrow_upward",
								}}
								size={15}
								weight="bold"
								tintColor={ready ? colors.bg : colors.textFaint}
							/>
						</View>
					</Pressable>
				</View>
			</FoodFormCard>
		</View>
	);
}
