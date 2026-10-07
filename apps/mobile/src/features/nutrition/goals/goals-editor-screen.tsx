import {
	GOAL_PRESET_KEYS,
	NUTRIENT_DEFAULT_DIRECTIONS,
	NUTRIENT_UNITS,
	type NutrientKey,
} from "@workouts/core/nutrition";
import {
	Stack,
	useLocalSearchParams,
	useNavigation,
	useRouter,
} from "expo-router";
import { usePreventRemove } from "expo-router/build/react-navigation/core";
import { SymbolView } from "expo-symbols";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Keyboard,
	Pressable,
	ScrollView,
	type TextInput,
	useWindowDimensions,
	View,
} from "react-native";
import { type IsoDate, isoDateToLocalDate } from "../../../data/calendar-day";
import {
	type GoalKind,
	goalKind,
	referenceGoalTarget,
} from "../../../data/nutrition-goal-history";
import { useReduceMotion } from "../../../feedback/reduce-motion";
import { fmt, useI18n } from "../../../i18n";
import { radius, spacing, useTokens } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { DatePickerSheet } from "../../../ui/date-picker-sheet";
import { EmptyState } from "../../../ui/empty-state";
import { SkeletonBlock, SkeletonGroup } from "../../../ui/skeleton";
import { SwipeableRow } from "../../../ui/swipeable-row";
import { AppText } from "../../../ui/text";
import { ToastProvider } from "../../../ui/toast";
import { NutritionChoiceMenu } from "../components/nutrition-choice-menu";
import { GoalNumberField } from "./components/goal-number-field";
import { GoalKindLabel, GoalRow } from "./components/goal-row";
import { GoalsKeyboardBar } from "./components/goals-keyboard-bar";
import { GoalsStartPicker } from "./components/goals-start-picker";
import { goalsAppliesFrom } from "./goals-applies-from";
import { type GoalFieldKey, useGoalsEditor } from "./use-goals-editor";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS: readonly GoalKind[] = ["min", "max", "range"];

/** The sheet hosts its own toasts: the app-level ones draw beneath a native sheet. */
export function GoalsEditorScreen() {
	return (
		<ToastProvider>
			<GoalsEditor />
		</ToastProvider>
	);
}

function GoalsEditor() {
	const { t, locale } = useI18n();
	const { width } = useWindowDimensions();
	const copy = t.nutrition.goalEditor;
	const colors = useTokens();
	const router = useRouter();
	const navigation = useNavigation();
	const confirm = useConfirm();
	const reduceMotion = useReduceMotion();
	const params = useLocalSearchParams<{ date?: string; nutrient?: string }>();
	const requestedDate =
		typeof params.date === "string" && ISO_DATE.test(params.date)
			? params.date
			: undefined;
	const [leaving, setLeaving] = useState(false);
	const editor = useGoalsEditor({
		requestedDate,
		onSaved: () => setLeaving(true),
	});
	const [dateOpen, setDateOpen] = useState(false);
	const [focused, setFocused] = useState<GoalFieldKey | null>(null);
	const inputs = useRef(new Map<GoalFieldKey, TextInput>());
	const rowOffsets = useRef(new Map<NutrientKey, number>());
	const goalsTop = useRef(0);
	const scroll = useRef<ScrollView>(null);
	const pendingFocus = useRef<GoalFieldKey | null>(null);
	const requestedNutrient =
		typeof params.nutrient === "string" &&
		params.nutrient in NUTRIENT_DEFAULT_DIRECTIONS
			? (params.nutrient as NutrientKey)
			: undefined;
	const requestHandled = useRef(false);

	// Deep links can open the editor with nothing beneath it.
	const close = () =>
		router.canGoBack() ? router.back() : router.replace("/nutrition");
	const closed = useRef(false);
	useEffect(() => {
		if (!leaving || closed.current) return;
		closed.current = true;
		close();
	});

	usePreventRemove(editor.dirty && !leaving, ({ data }) => {
		if (editor.pending) return;
		void confirm({
			title:
				editor.changedCount === 1
					? copy.discardMessageOne
					: fmt(copy.discardMessage, { count: editor.changedCount }),
			confirmLabel: copy.discard,
			cancelLabel: copy.keepEditing,
			destructive: true,
		}).then((ok) => {
			if (ok) navigation.dispatch(data.action);
		});
	});

	const focusField = (key: GoalFieldKey) => {
		const nutrient = key.split(".")[0] as NutrientKey;
		const y = rowOffsets.current.get(nutrient);
		if (y !== undefined)
			scroll.current?.scrollTo({
				y: Math.max(0, goalsTop.current + y - 120),
				animated: !reduceMotion,
			});
		requestAnimationFrame(() => inputs.current.get(key)?.focus());
	};

	// A field added or asked for by `?nutrient=` exists only after the next
	// render; focus it once it has registered its input.
	useEffect(() => {
		const key = pendingFocus.current;
		if (key && inputs.current.has(key)) {
			pendingFocus.current = null;
			focusField(key);
		}
	});

	// "Edit goal" from the diary opens with that nutrient's first field ready.
	useEffect(() => {
		if (requestHandled.current || !editor.ready || !requestedNutrient) return;
		requestHandled.current = true;
		const kind = goalKind(editor.values[requestedNutrient]);
		pendingFocus.current = kind
			? `${requestedNutrient}.${kind === "max" ? "max" : "min"}`
			: editor.addGoal(requestedNutrient);
	}, [editor, requestedNutrient]);

	const fieldIndex = focused ? editor.fields.indexOf(focused) : -1;
	const nutrientName = (nutrient: NutrientKey) =>
		t.nutrition.nutrients[nutrient];
	const fieldLabel = (key: GoalFieldKey) => {
		const [nutrient, direction] = key.split(".") as [
			NutrientKey,
			"min" | "max",
		];
		return fmt(copy.field, {
			nutrient: nutrientName(nutrient),
			direction: copy.kinds[direction].label.toLowerCase(),
		});
	};

	const save = async () => {
		Keyboard.dismiss();
		const firstError = await editor.save();
		if (firstError) {
			const y = rowOffsets.current.get(firstError);
			if (y !== undefined)
				scroll.current?.scrollTo({
					y: Math.max(0, goalsTop.current + y - 120),
					animated: !reduceMotion,
				});
		}
	};

	const headerButton = (
		label: string,
		glyph: "xmark" | "checkmark",
		onPress: () => void,
		disabled: boolean,
		prominent = false,
	) => (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={{
				minWidth: 44,
				minHeight: 44,
				alignItems: "center",
				justifyContent: "center",
				borderRadius: radius.pill,
				backgroundColor: prominent ? colors.accentFill : undefined,
				opacity: disabled ? 0.4 : 1,
			}}
		>
			<SymbolView
				name={{
					ios: glyph,
					android: glyph === "xmark" ? "close" : "check",
					web: glyph === "xmark" ? "close" : "check",
				}}
				size={20}
				tintColor={prominent ? colors.onAccent : colors.text}
			/>
		</Pressable>
	);

	const header = (
		<Stack.Screen
			options={{
				title: copy.title,
				headerShown: true,
				gestureEnabled: !editor.dirty && !editor.pending,
				headerTitleStyle: { color: colors.text },
				headerLeft: () =>
					headerButton(copy.close, "xmark", close, editor.pending),
				unstable_headerRightItems: () =>
					editor.pending
						? [
								{
									type: "custom",
									element: (
										<ActivityIndicator accessibilityLabel={copy.saving} />
									),
								},
							]
						: [
								{
									type: "button",
									label: copy.save,
									accessibilityLabel: copy.save,
									icon: { type: "sfSymbol", name: "checkmark" },
									variant: editor.dirty ? "prominent" : "plain",
									tintColor: editor.dirty ? colors.accentFill : colors.text,
									disabled: !editor.dirty,
									onPress: () => void save(),
								},
							],
				headerRight: () =>
					editor.pending ? (
						<ActivityIndicator accessibilityLabel={copy.saving} />
					) : (
						headerButton(
							copy.save,
							"checkmark",
							() => void save(),
							!editor.dirty,
							editor.dirty,
						)
					),
			}}
		/>
	);

	if (editor.loading) {
		return (
			<View style={{ flex: 1, backgroundColor: colors.bg }}>
				{header}
				<ScrollView
					contentInsetAdjustmentBehavior="automatic"
					contentContainerStyle={{ padding: spacing.md }}
				>
					{editor.stalledOffline ? (
						<View
							style={{
								backgroundColor: colors.surface,
								borderRadius: radius.contentCard,
								marginTop: spacing.lg,
							}}
						>
							<EmptyState
								title={copy.offlineTitle}
								body={copy.offlineBody}
								action={{ label: copy.tryAgain, onPress: editor.retry }}
							/>
						</View>
					) : (
						<SkeletonGroup label={copy.loading}>
							<View style={{ gap: spacing.md }}>
								<SkeletonBlock height={50} />
								<SkeletonBlock height={50} />
								<SkeletonBlock height={300} />
							</View>
						</SkeletonGroup>
					)}
				</ScrollView>
			</View>
		);
	}

	const version = editor.version;
	const footer = version
		? goalsAppliesFrom({
				date: editor.date,
				today: editor.today,
				requestedDate,
				version,
				locale,
				copy,
			})
		: undefined;
	const dateValue =
		editor.date === editor.today
			? copy.today
			: isoDateToLocalDate(editor.date).toLocaleDateString(locale, {
					weekday: "short",
					day: "numeric",
					month: "short",
				});
	const presetLabel = editor.preset
		? copy.presets[editor.preset].name
		: copy.custom;
	const presetValue = editor.preset
		? editor.editedCount > 0
			? fmt(copy.edited, { count: editor.editedCount })
			: copy.unchanged
		: copy.noPreset;
	const kindItems = (nutrient: NutrientKey) => {
		const kind = goalKind(editor.values[nutrient]);
		return [
			KINDS.map((item) => ({
				id: item,
				label: copy.kinds[item].label,
				hint: copy.kinds[item].hint,
				selected: item === kind,
			})),
			[{ id: "remove", label: copy.removeGoal, destructive: true }],
		];
	};
	const onKind = (nutrient: NutrientKey, id: string) => {
		Keyboard.dismiss();
		if (id === "remove") editor.removeGoal(nutrient);
		else editor.setKind(nutrient, id as GoalKind);
	};

	return (
		<View style={{ flex: 1, backgroundColor: colors.bg }}>
			{header}
			<ScrollView
				ref={scroll}
				style={{ flex: 1 }}
				contentInsetAdjustmentBehavior="automatic"
				automaticallyAdjustKeyboardInsets
				keyboardDismissMode="interactive"
				keyboardShouldPersistTaps="handled"
				pointerEvents={editor.pending ? "none" : "auto"}
				contentContainerStyle={{
					padding: spacing.md,
					paddingBottom: spacing.xxl * 2,
					gap: spacing.xs,
				}}
			>
				{editor.showStartPicker ? (
					<GoalsStartPicker
						onPreset={editor.applyPreset}
						onCustom={() => {
							pendingFocus.current = editor.addGoal("energy");
						}}
					/>
				) : (
					<>
						<Card>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={`${copy.appliesFrom}, ${dateValue}`}
								onPress={() => {
									Keyboard.dismiss();
									setDateOpen(true);
								}}
								style={rowStyle}
							>
								<AppText
									variant="secondary"
									style={{ flex: 1, color: colors.text }}
								>
									{copy.appliesFrom}
								</AppText>
								<Value text={dateValue} accent />
							</Pressable>
						</Card>
						{footer ? (
							<AppText variant="footnote" style={footnoteStyle}>
								{footer.lead ? (
									<AppText
										variant="footnote"
										style={{ fontWeight: "700", color: colors.text }}
									>
										{footer.lead}{" "}
									</AppText>
								) : null}
								{footer.body}
							</AppText>
						) : null}
						<SectionLabel>{copy.startingPoint}</SectionLabel>
						<Card>
							<NutritionChoiceMenu
								accessibilityLabel={`${copy.startingPoint}, ${presetLabel}, ${presetValue}`}
								title={copy.presetMenuTitle}
								sections={[
									GOAL_PRESET_KEYS.map((key) => ({
										id: key,
										label: copy.presets[key].name,
										hint: copy.presetMenuHint[key],
										selected: key === editor.preset,
									})),
									...(editor.preset && editor.editedCount > 0
										? [
												[
													{
														id: "restore",
														label: fmt(copy.restore, {
															name: copy.presets[editor.preset].name,
														}),
														hint: fmt(copy.restoreHint, {
															count: editor.editedCount,
														}),
													},
												],
											]
										: []),
								]}
								onSelect={(id) => {
									Keyboard.dismiss();
									if (id === "restore" && editor.preset)
										editor.applyPreset(editor.preset);
									else
										editor.applyPreset(id as (typeof GOAL_PRESET_KEYS)[number]);
								}}
							>
								<View style={[rowStyle, { width: width - spacing.md * 2 }]}>
									<AppText
										variant="secondary"
										style={{ flex: 1, color: colors.text }}
									>
										{presetLabel}
									</AppText>
									<Value text={presetValue} />
								</View>
							</NutritionChoiceMenu>
						</Card>
						<AppText variant="footnote" style={footnoteStyle}>
							{editor.preset ? copy.staticFooter : copy.customFooter}
						</AppText>
						<SectionLabel>{copy.goals}</SectionLabel>
						<View
							onLayout={(event) => {
								goalsTop.current = event.nativeEvent.layout.y;
							}}
						>
							<Card>
								{editor.active.length === 0 ? (
									<AppText variant="secondary" style={{ padding: spacing.md }}>
										{copy.noGoals}
									</AppText>
								) : (
									editor.active.map((nutrient, index) => {
										const kind = goalKind(editor.values[nutrient]) ?? "max";
										const directions = (["min", "max"] as const).filter(
											(direction) => kind === "range" || kind === direction,
										);
										return (
											<View
												key={nutrient}
												onLayout={(event) =>
													rowOffsets.current.set(
														nutrient,
														event.nativeEvent.layout.y,
													)
												}
												style={
													index > 0
														? {
																borderTopWidth: 0.5,
																borderTopColor: colors.separator,
															}
														: undefined
												}
											>
												<SwipeableRow
													menuTitle={nutrientName(nutrient)}
													closeMenuLabel={copy.close}
													actions={[
														...KINDS.map((item) => ({
															key: item,
															label: copy.kinds[item].label,
															swipe: false,
															onPress: () => onKind(nutrient, item),
														})),
														{
															key: "remove",
															label: copy.removeGoal,
															destructive: true,
															fullSwipe: true,
															onPress: () => onKind(nutrient, "remove"),
														},
													]}
												>
													{(accessibility) => (
														<Pressable
															{...accessibility}
															accessible={false}
															delayLongPress={350}
														>
															<GoalRow
																name={nutrientName(nutrient)}
																unit={NUTRIENT_UNITS[nutrient]}
																error={editor.errors[nutrient]}
																kind={
																	<NutritionChoiceMenu
																		accessibilityLabel={fmt(copy.kindMenu, {
																			nutrient: nutrientName(nutrient),
																		})}
																		sections={kindItems(nutrient)}
																		onSelect={(id) => onKind(nutrient, id)}
																		style={{ alignSelf: "flex-start" }}
																	>
																		<GoalKindLabel
																			label={copy.kinds[kind].label}
																		/>
																	</NutritionChoiceMenu>
																}
																fields={directions.map(
																	(direction, position) => {
																		const key: GoalFieldKey = `${nutrient}.${direction}`;
																		return (
																			<View
																				key={key}
																				style={{
																					flexDirection: "row",
																					alignItems: "center",
																					gap: 6,
																				}}
																			>
																				{position > 0 ? (
																					<AppText variant="footnote">
																						–
																					</AppText>
																				) : null}
																				<GoalNumberField
																					inputRef={(input) => {
																						if (input)
																							inputs.current.set(key, input);
																						else inputs.current.delete(key);
																					}}
																					value={
																						editor.values[nutrient][direction]
																					}
																					locale={locale}
																					accessibilityLabel={fieldLabel(key)}
																					invalid={Boolean(
																						editor.errors[nutrient],
																					)}
																					disabled={editor.pending}
																					onChange={(text) =>
																						editor.setValue(
																							nutrient,
																							direction,
																							text,
																						)
																					}
																					onFocus={() => setFocused(key)}
																					onBlur={() =>
																						setFocused((current) =>
																							current === key ? null : current,
																						)
																					}
																					onSubmitEditing={() => {
																						const next =
																							editor.fields[
																								editor.fields.indexOf(key) + 1
																							];
																						if (next) focusField(next);
																					}}
																				/>
																			</View>
																		);
																	},
																)}
															/>
														</Pressable>
													)}
												</SwipeableRow>
											</View>
										);
									})
								)}
							</Card>
						</View>
						{editor.inactive.length > 0 ? (
							<>
								<SectionLabel>{copy.withoutGoal}</SectionLabel>
								<Card>
									{editor.inactive.map((nutrient, index) => (
										<View
											key={nutrient}
											style={[
												rowStyle,
												index > 0
													? {
															borderTopWidth: 0.5,
															borderTopColor: colors.separator,
														}
													: null,
											]}
										>
											<View style={{ flex: 1 }}>
												<AppText
													variant="secondary"
													style={{ color: colors.text }}
												>
													{nutrientName(nutrient)}
												</AppText>
												<AppText variant="footnote">
													{fmt(copy.referenceHint, {
														direction:
															copy.directionShort[
																NUTRIENT_DEFAULT_DIRECTIONS[nutrient]
															],
														amount: `${referenceGoalTarget(nutrient).toLocaleString(locale)} ${NUTRIENT_UNITS[nutrient]}`,
													})}
												</AppText>
											</View>
											<Pressable
												accessibilityRole="button"
												accessibilityLabel={fmt(copy.addGoal, {
													nutrient: nutrientName(nutrient),
												})}
												onPress={() => {
													pendingFocus.current = editor.addGoal(nutrient);
												}}
												style={({ pressed }) => ({
													width: 36,
													height: 36,
													borderRadius: radius.pill,
													alignItems: "center",
													justifyContent: "center",
													backgroundColor: pressed
														? colors.borderStrong
														: colors.surface2,
												})}
												hitSlop={4}
											>
												<SymbolView
													name={{ ios: "plus", android: "add", web: "add" }}
													size={15}
													weight="semibold"
													tintColor={colors.accent}
												/>
											</Pressable>
										</View>
									))}
								</Card>
							</>
						) : null}
						{editor.active.length > 0 ? (
							<View style={{ marginTop: spacing.lg }}>
								<Card>
									<Pressable
										accessibilityRole="button"
										onPress={() => {
											Keyboard.dismiss();
											editor.removeAll();
										}}
										style={[rowStyle, { justifyContent: "center" }]}
									>
										<AppText
											variant="secondary"
											style={{ color: colors.danger }}
										>
											{copy.removeAll}
										</AppText>
									</Pressable>
								</Card>
							</View>
						) : null}
					</>
				)}
			</ScrollView>
			<GoalsKeyboardBar
				label={focused ? fieldLabel(focused) : null}
				previousLabel={copy.previousField}
				nextLabel={copy.nextField}
				doneLabel={copy.done}
				onPrevious={
					fieldIndex > 0
						? () => focusField(editor.fields[fieldIndex - 1])
						: undefined
				}
				onNext={
					fieldIndex >= 0 && fieldIndex < editor.fields.length - 1
						? () => focusField(editor.fields[fieldIndex + 1])
						: undefined
				}
			/>
			<DatePickerSheet
				visible={dateOpen}
				date={editor.date}
				today={editor.today}
				locale={locale}
				title={copy.appliesFrom}
				todayLabel={copy.today}
				doneLabel={copy.done}
				closeLabel={copy.close}
				onSelect={(next: IsoDate) => {
					editor.setDate(next);
					setDateOpen(false);
				}}
				onClose={() => setDateOpen(false)}
			/>
		</View>
	);
}

const rowStyle = {
	minHeight: 50,
	paddingHorizontal: spacing.md,
	paddingVertical: 10,
	flexDirection: "row" as const,
	alignItems: "center" as const,
	gap: spacing.sm,
};

const footnoteStyle = {
	paddingHorizontal: spacing.xs,
	paddingTop: 6,
	paddingBottom: spacing.sm,
};

function Card({ children }: { children: ReactNode }) {
	const colors = useTokens();
	return (
		<View
			style={{
				backgroundColor: colors.surface,
				borderRadius: radius.contentCard,
				borderCurve: "continuous",
				overflow: "hidden",
			}}
		>
			{children}
		</View>
	);
}

function SectionLabel({ children }: { children: string }) {
	return (
		<AppText
			variant="footnote"
			accessibilityRole="header"
			style={{ paddingHorizontal: spacing.xs, paddingTop: spacing.sm }}
		>
			{children}
		</AppText>
	);
}

function Value({ text, accent = false }: { text: string; accent?: boolean }) {
	const colors = useTokens();
	return (
		<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
			<AppText
				variant="secondary"
				style={{
					color: accent ? colors.accent : colors.textMuted,
					fontWeight: accent ? "700" : "400",
				}}
			>
				{text}
			</AppText>
			<SymbolView
				name={{
					ios: "chevron.up.chevron.down",
					android: "unfold_more",
					web: "unfold_more",
				}}
				size={11}
				weight="semibold"
				tintColor={accent ? colors.accent : colors.textMuted}
			/>
		</View>
	);
}
