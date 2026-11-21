/**
 * The set editor. Open sets change in place, so a closed sheet or a restart
 * keeps the input; a logged set's changes stay a draft until Save.
 */
import {
	calcPlates,
	convertLoad,
	DEFAULT_BAR,
	estimatedMaxReps,
	formatClock,
	SET_LIMITS,
	SET_TYPES,
} from "@foundry/core";
import {
	Stack,
	useLocalSearchParams,
	useNavigation,
	usePreventRemove,
	useRouter,
} from "expo-router";
import {
	type ComponentRef,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	Keyboard,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Id } from "../../convex/api";
import { useQuery } from "../../convex/query-cache";
import { fmt, parseLocalizedDecimal, useI18n } from "../../i18n";
import {
	PREFERENCE_KEYS,
	readLocal,
	writeLocal,
} from "../../local-store/local-store";
import {
	opacity,
	radius,
	spacing,
	type Tokens,
	type,
	useThemedStyles,
	useTokens,
} from "../../theme";
import { Segmented } from "../../ui/segmented";
import { SelectionMenu } from "../../ui/selection-menu";
import { AppText } from "../../ui/text";
import { useChoice } from "../../ui/use-choice";
import { useLargeText } from "./components/session-set-row";
import { useRestState } from "./data/rest-timer";
import { useSessionActions } from "./data/session-actions";
import { useSessionWorkspace, workspaceStore } from "./data/session-workspace";
import {
	formatLoadOnly,
	formatNumber,
	formatSetFull,
	formatSetShort,
} from "./session-format";
import {
	applyPercent,
	bestKnown,
	confirmKey,
	findRow,
	groupOfRow,
	isValidRow,
	loadStep,
	type PlanSet,
	referenceFor,
	repeatRow,
	resetToPlan,
	rowOneRepMax,
	rowsOf,
	sameSet,
	shownLoad,
	snapLoad,
	stepLoad,
	switchUnit,
	targetPercent,
	typoCheck,
	updateRow,
	withTypedLoad,
} from "./session-plan";
import {
	latestBodyweightKg,
	levelKey,
	levelOf,
	startLoadKg,
	strengthLevels,
} from "./strength-levels";
import { useKeyboardHeight } from "./use-keyboard-height";

const PRESETS = [60, 65, 70, 75, 80, 85, 90];
const RPE_CHIPS = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];
type EditorMode = "simple" | "advanced";
const readMode = (): EditorMode =>
	readLocal(PREFERENCE_KEYS.setEditorMode) === "advanced"
		? "advanced"
		: "simple";
/** Reps a starting weight from a level is meant for. */
const START_REPS = 8;
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
type FieldRef = RefObject<ComponentRef<typeof TextInput> | null>;
const parseNumber = (text: string) => parseLocalizedDecimal(text) ?? Number.NaN;

function NumberField({
	label,
	value,
	placeholder,
	decimal,
	inputRef,
	onChange,
	onFocus,
	onBlur,
	disabled,
	testID,
}: {
	label: string;
	value: string;
	placeholder: string;
	decimal: boolean;
	inputRef: FieldRef;
	onChange: (text: string) => void;
	onFocus: () => void;
	onBlur: () => void;
	disabled: boolean;
	testID: string;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.fieldColumn}>
			<AppText
				variant="label"
				numberOfLines={1}
				adjustsFontSizeToFit
				minimumFontScale={0.5}
				style={styles.fieldLabel}
			>
				{label}
			</AppText>
			<TextInput
				ref={inputRef}
				accessibilityLabel={label}
				value={value}
				editable={!disabled}
				keyboardType={decimal ? "decimal-pad" : "number-pad"}
				selectTextOnFocus
				onChangeText={onChange}
				onFocus={onFocus}
				onBlur={onBlur}
				placeholder={placeholder}
				placeholderTextColor={colors.textFaint}
				style={styles.field}
				testID={testID}
			/>
		</View>
	);
}
/** The sheet's header has a fixed height, so its title scales only so far. */
const NAV_TITLE_MAX_SCALE = 1.3;

function StepButton({
	label,
	spoken,
	onPress,
	disabled,
}: {
	label: string;
	spoken: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={spoken}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.step,
				pressed && styles.pressed,
				disabled && styles.dimmed,
			]}
		>
			<AppText
				variant="control"
				numberOfLines={1}
				adjustsFontSizeToFit
				minimumFontScale={0.5}
			>
				{label}
			</AppText>
		</Pressable>
	);
}

export function SetEditorScreen() {
	const params = useLocalSearchParams<{
		sessionId: Id<"workoutSessions">;
		rowId: string;
	}>();
	const workspace = useSessionWorkspace(params.sessionId);
	const actions = useSessionActions(workspace);
	const { key, plan, getFacts, nameOf, catalog, drafts } = workspace;
	const router = useRouter();
	const navigation = useNavigation();
	const { locale, t } = useI18n();
	const largeText = useLargeText();
	const copy = t.strength.plan;
	const text = copy.editor;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const choose = useChoice();
	const restState = useRestState();
	const stored = plan ? findRow(plan, params.rowId) : undefined;
	// An edit only ever applies to a set that is still logged.
	const draft = stored?.done ? drafts[params.rowId] : undefined;
	const row = draft ?? stored;
	const facts = row ? getFacts(row.exerciseId) : null;
	const [focus, setFocus] = useState<"kg" | "reps" | "percent" | null>(null);
	const [loadText, setLoadText] = useState("");
	const [repsText, setRepsText] = useState("");
	const [percentText, setPercentText] = useState("");
	const [customOpen, setCustomOpen] = useState(false);
	const [mode, setMode] = useState<EditorMode>(readMode);
	const advanced = mode === "advanced";
	const toggleMode = () => {
		const next: EditorMode = advanced ? "simple" : "advanced";
		setMode(next);
		writeLocal(PREFERENCE_KEYS.setEditorMode, next);
	};
	const bodyMetrics = useQuery(api.bodyMetrics.list, advanced ? {} : "skip");
	const keyboard = useKeyboardHeight();
	const loadRef = useRef<ComponentRef<typeof TextInput>>(null);
	const repsRef = useRef<ComponentRef<typeof TextInput>>(null);
	const percentRef = useRef<ComponentRef<typeof TextInput>>(null);
	const logged = Boolean(stored?.done);
	const changed = Boolean(logged && stored && draft && !sameSet(draft, stored));
	const [saving, setSaving] = useState(false);
	const sending =
		saving ||
		Boolean(
			row?.attempt && workspaceStore.inFlight(key).has(row.attempt.operationId),
		);
	// A send with an unknown result froze these values: a retry must match them.
	const locked = sending || Boolean(row?.attempt);
	const close = () => {
		if (router.canGoBack()) router.back();
	};
	const parent = navigation.getParent();
	useEffect(() => {
		// A changed logged set can't be swiped away: it asks to save or discard.
		parent?.setOptions({ gestureEnabled: !changed });
	}, [changed, parent]);
	// The guard has to be off before the blocked action can be replayed.
	const [leaving, setLeaving] = useState(false);
	const afterLeave = useRef<(() => void) | null>(null);
	useEffect(() => {
		if (leaving) afterLeave.current?.();
	}, [leaving]);
	usePreventRemove(changed && !leaving, ({ data }) => {
		void (async () => {
			const save = await choose({
				title: text.discardTitle,
				message: text.discardMessage,
				confirm: { label: text.save },
				cancel: text.discard,
				dismiss: text.keepEditing,
			});
			if (save === null) return;
			if (save && draft && !(await actions.setLogged(params.rowId, draft)))
				return;
			workspaceStore.setDraft(key, params.rowId, null);
			afterLeave.current = () => navigation.dispatch(data.action);
			setLeaving(true);
		})();
	});
	useEffect(() => {
		// Closes once the set no longer exists, for example after a delete.
		if (plan && !stored && router.canGoBack()) router.back();
	}, [plan, router, stored]);
	if (!plan || !row || !facts) return <Stack.Screen options={{ title: "" }} />;
	const bodyweight = facts.bodyweight;
	const timed = facts.timed;
	/** Seconds move in fives on a hold; reps move one at a time. */
	const countStep = timed ? 5 : 1;
	const group = groupOfRow(plan, row.id);
	const roundIndex = group
		? group.rounds.findIndex((round) =>
				round.items.some((item) => item.id === row.id),
			)
		: -1;
	const reference = referenceFor(plan, facts, row.exerciseId);
	const name = nameOf(row.exerciseId);
	const mates = rowsOf(plan, row.exerciseId).filter(
		(item) => item.kind !== "warmup",
	);
	const title =
		row.kind === "warmup"
			? fmt(text.titleWarmup, { name })
			: group
				? fmt(text.titleRound, { name, number: roundIndex + 1 })
				: fmt(text.titleSet, {
						name,
						number: mates.findIndex((item) => item.id === row.id) + 1,
					});
	function change(next: PlanSet) {
		if (locked) return;
		if (logged) workspaceStore.setDraft(key, row?.id as string, next);
		else actions.set(updateRow(actions.plan(), next.id, next));
	}
	const load = shownLoad(row);
	const loadShown =
		focus === "kg"
			? loadText
			: !bodyweight && !(row.kg > 0)
				? ""
				: formatNumber(load, locale, row.unit === "lbs" ? 1 : 2);
	const repsShown =
		focus === "reps"
			? repsText
			: row.blank && row.reps < 1
				? ""
				: String(row.reps);
	const valid = isValidRow(row, facts);
	const midType = focus === "kg" || focus === "reps";
	// A cleared or unreadable field isn't the old value: nothing logs until it's filled.
	const typedEmpty =
		(focus === "kg" &&
			(loadText.trim() === "" ||
				!Number.isFinite(parseNumber(loadText)) ||
				parseNumber(loadText) < 0)) ||
		(focus === "reps" &&
			(repsText.trim() === "" ||
				!Number.isInteger(Number(repsText)) ||
				Number(repsText) < 0));
	const check = valid && !midType ? typoCheck(plan, row, facts, stored) : null;
	const others = bestKnown(plan, row.exerciseId, facts, row.id);
	const estimate = rowOneRepMax(row, facts);
	const target = targetPercent(row, reference, facts.stepKg);
	const custom = target !== null && !PRESETS.includes(target);
	const clockIdle =
		group?.mode === "amrap" && group.state === "idle" && !logged;
	const fullLoad = formatSetFull(row, facts, locale);
	const loadOnly = formatLoadOnly(row, facts, locale);

	let referenceLine = "";
	if (reference && !bodyweight && row.kg > 0) {
		const refText = formatNumber(Math.round(reference.value * 10) / 10, locale);
		const actual = Math.round((row.kg / reference.value) * 100);
		const source =
			reference.source === "manual" ? text.sourceManual : text.sourceMeasured;
		if (
			row.done &&
			typeof row.loggedPercent === "number" &&
			Math.abs(actual - row.loggedPercent) > 2
		)
			referenceLine = fmt(text.lineLogged, {
				logged: formatNumber(row.loggedPercent, locale, 1),
				now: actual,
				source,
				ref: refText,
				unit: "kg",
			});
		else if (target !== null) {
			const exact = (reference.value * target) / 100;
			const values = {
				percent: formatNumber(target, locale, 1),
				source: reference.source === "manual" ? text.sourceManualShort : "",
				ref: refText,
				exact: formatNumber(Math.round(exact * 10) / 10, locale),
				load: loadOnly,
				actual,
			};
			referenceLine = near(exact, row.kg)
				? fmt(text.lineExact, {
						percent: values.percent,
						source,
						ref: refText,
						unit: "kg",
					})
				: actual === target
					? fmt(text.lineTarget, values)
					: fmt(text.lineTargetActual, values);
		} else
			referenceLine = fmt(text.lineActual, {
				percent: actual,
				source,
				ref: refText,
				unit: "kg",
			});
	}

	let note = "";
	let highlight = false;
	if (valid && !bodyweight) {
		if (row.reps < 1) note = text.noteMissed;
		else if (row.kind === "warmup") note = text.noteWarmup;
		else if (row.reps > 10) note = text.noteHighReps;
		else if (row.reps === 1) {
			if (others.measured === null || row.kg > others.measured) {
				highlight = !stored?.done;
				note = text.noteNewMeasured;
			}
		} else if (others.estimated === null) note = text.noteFirst;
		else if (
			estimate &&
			Math.round(estimate.value) > Math.round(others.estimated)
		) {
			highlight = true;
			note = fmt(text.noteBetter, { value: Math.round(others.estimated) });
		}
		if (check) {
			highlight = false;
			note = fmt(
				(copy.checks as Record<string, string>)[check.code] ?? "",
				check.values,
			);
		}
	} else if (check)
		note = fmt(
			(copy.checks as Record<string, string>)[check.code] ?? "",
			check.values,
		);

	const exercise = catalog.find((item) => item._id === row.exerciseId);
	const bodyweightKg = latestBodyweightKg(bodyMetrics);
	const levels =
		bodyweight || reference
			? null
			: strengthLevels(levelKey(row.exerciseId), bodyweightKg);
	const where =
		levels && estimate && bodyweightKg
			? levelOf(levels, estimate.value, bodyweightKg)
			: null;
	const levelName = (index: number) => {
		const level = levels?.[index];
		return level ? text.levels[level.id] : "";
	};
	const levelLine = where
		? where.toNextKg === null
			? fmt(text.levelWhereTop, {
					value: Math.round(estimate?.value ?? 0),
					level: levelName(where.index),
				})
			: fmt(text.levelWhere, {
					value: Math.round(estimate?.value ?? 0),
					level: levelName(where.index),
					next: where.toNextKg,
					nextLevel: levelName(where.index + 1),
				})
		: bodyweightKg
			? text.levelGuide
			: text.levelsNoWeight;
	const plateLine =
		exercise?.equipment === "barbell" &&
		row.unit === "kg" &&
		row.kg >= DEFAULT_BAR.kg
			? (() => {
					const result = calcPlates(row.kg, DEFAULT_BAR.kg, "kg");
					return result.perSide.length
						? fmt(text.plates, {
								plates: result.perSide
									.map((plate) => formatNumber(plate, locale))
									.join(" + "),
							})
						: text.platesNone;
				})()
			: null;
	const planLoad = row.plan
		? formatSetShort(
				{ ...row, kg: row.plan.kg, reps: row.plan.reps, typedLbs: undefined },
				facts,
				locale,
			)
		: null;
	const onPlan =
		row.plan && near(row.plan.kg, row.kg) && row.plan.reps === row.reps;

	const detailValues = {
		load: loadOnly,
		measured: reference ? Math.round((row.kg / reference.value) * 100) : 0,
		measuredRef: reference
			? formatNumber(Math.round(reference.value), locale)
			: "",
		estimated: others.estimated
			? Math.round((row.kg / others.estimated) * 100)
			: 0,
		estimatedRef: others.estimated ? Math.round(others.estimated) : "",
	};
	const theory = (value: number) => estimatedMaxReps(value, row.kg) ?? 0;
	const detail =
		!valid || bodyweight
			? ""
			: reference && others.estimated
				? fmt(text.detail, detailValues)
				: reference
					? fmt(text.detailMeasuredOnly, detailValues)
					: others.estimated
						? fmt(text.detailEstimatedOnly, detailValues)
						: "";
	const detailReps =
		!valid || bodyweight || row.kg <= 0
			? ""
			: reference &&
					others.estimated &&
					theory(reference.value) >= 1 &&
					theory(others.estimated) >= 1
				? fmt(text.detailReps, {
						measured: theory(reference.value),
						estimated: theory(others.estimated),
					})
				: reference && theory(reference.value) >= 1
					? fmt(text.detailRepsMeasured, { measured: theory(reference.value) })
					: others.estimated && theory(others.estimated) >= 1
						? fmt(text.detailRepsEstimated, {
								estimated: theory(others.estimated),
							})
						: "";
	const previousLine = logged
		? text.loggedSub
		: facts.last
			? fmt(text.previous, {
					load: formatSetShort(
						{ kg: facts.last.kg, reps: facts.last.reps, unit: "kg" },
						facts,
						locale,
					),
				})
			: text.firstTime;
	const restLine = restState.running
		? restState.over
			? text.restOver
			: fmt(text.restSub, { time: formatClock(restState.remaining) })
		: null;
	const subtitle =
		locked && !sending
			? text.lockedUnknown
			: [previousLine, restLine].filter(Boolean).join(" · ");

	const enterCount = timed ? text.enterSeconds : text.enterReps;
	let primary = fmt(text.logLoad, { load: fullLoad });
	let primaryEnabled = true;
	if (sending) {
		primary = text.lockedBusy;
		primaryEnabled = false;
	} else if (locked) {
		primary = fmt(text.retry, { load: fullLoad });
	} else if (clockIdle) {
		primary = text.startClockFirst;
		primaryEnabled = false;
	} else if (typedEmpty) {
		primaryEnabled = false;
		primary = focus === "kg" ? text.enterLoad : enterCount;
	} else if (!valid) {
		primaryEnabled = false;
		const noLoad = !bodyweight && !(row.kg > 0);
		const noReps = Boolean(row.blank && row.reps < 1);
		primary =
			noLoad && noReps
				? text.enterBoth
				: noLoad
					? text.enterLoad
					: noReps
						? enterCount
						: shownLoad(row) > SET_LIMITS.weight.max
							? text.checkLoad
							: timed
								? text.checkSeconds
								: text.checkReps;
	} else if (check)
		primary =
			check.kind === "reps"
				? fmt(text.confirmReps, { reps: row.reps })
				: fmt(text.confirmLoad, { load: loadOnly });
	else if (logged) {
		primary = changed ? fmt(text.saveLoad, { load: fullLoad }) : text.noChanges;
	} else if (row.failed) primary = fmt(text.retry, { load: fullLoad });
	async function onPrimary() {
		if (!row || !primaryEnabled) return;
		Keyboard.dismiss();
		// The field was still focused, so the button hasn't asked yet: show it first.
		if (midType && plan && facts && typoCheck(plan, row, facts, stored)) return;
		if (locked) {
			actions.logReady(row.id);
			close();
			return;
		}
		const confirmed: PlanSet = check
			? { ...row, confirmedKey: confirmKey(row) }
			: row;
		if (logged) {
			if (!changed) {
				close();
				return;
			}
			setSaving(true);
			const saved = await actions.setLogged(row.id, confirmed);
			setSaving(false);
			if (saved) {
				workspaceStore.setDraft(key, row.id, null);
				requestAnimationFrame(close);
			}
			return;
		}
		if (check) actions.set(updateRow(actions.plan(), row.id, confirmed));
		actions.logReady(row.id);
		close();
	}
	const stepLabel = formatNumber(loadStep(row.unit, facts.stepKg), locale);
	const onLoadText = (value: string) => {
		setLoadText(value);
		if (value.trim() === "") return;
		const parsed = parseNumber(value);
		if (Number.isFinite(parsed) && parsed >= 0)
			change(withTypedLoad(row, parsed));
	};
	const onRepsText = (value: string) => {
		setRepsText(value);
		if (value.trim() === "") return;
		const parsed = Number(value);
		if (Number.isInteger(parsed) && parsed >= 0)
			change({
				...row,
				reps: Math.min(parsed, SET_LIMITS.reps.max + 1),
				blank: undefined,
			});
	};
	const menuGroups = [
		{
			options: [
				{
					id: "mode",
					label: advanced ? text.modeSimple : text.modeAdvanced,
				},
				...(group
					? []
					: [
							{
								id: "repeat",
								label: copy.rowRepeat,
								disabled: !valid,
							},
						]),
				...(bodyweight ? [] : [{ id: "profile", label: copy.strengthProfile }]),
				{
					id: "delete",
					label: copy.rowDelete,
					destructive: true,
					disabled: locked,
				},
			],
		},
	];
	async function onMenu(id: string) {
		if (!row) return;
		if (id === "mode") toggleMode();
		else if (id === "repeat") {
			actions.apply(repeatRow(actions.plan(), row.id));
			close();
		} else if (id === "profile") {
			router.push({
				pathname: "/set-editor/strength-profile",
				params: {
					sessionId: params.sessionId,
					exerciseId: row.exerciseId,
					rowId: row.id,
				},
			});
		} else if (id === "delete") {
			if (row.setId) {
				const yes = await choose({
					title: text.deleteTitle,
					message: text.deleteLoggedMessage,
					confirm: { label: copy.rowDelete, destructive: true },
					cancel: copy.keepTraining,
				});
				if (!yes) return;
				workspaceStore.setDraft(key, row.id, null);
			}
			await actions.deleteRow(row.id);
		}
	}
	const applyCustom = () => {
		const value = parseNumber(percentText);
		if (
			reference &&
			Number.isFinite(value) &&
			value > 0 &&
			value <= SET_LIMITS.percentOfOneRepMax.max
		) {
			change(applyPercent(row, value, reference, facts));
			setCustomOpen(false);
			Keyboard.dismiss();
		}
	};
	const fieldsOrder = [loadRef, repsRef];
	return (
		<>
			<Stack.Screen
				options={{
					title,
					headerTitle: () => (
						<View
							style={styles.headerTitle}
							accessible
							accessibilityRole="header"
						>
							<AppText
								variant="navTitle"
								numberOfLines={1}
								maxFontSizeMultiplier={NAV_TITLE_MAX_SCALE}
							>
								{title}
							</AppText>
							<AppText
								variant="caption"
								numberOfLines={1}
								maxFontSizeMultiplier={NAV_TITLE_MAX_SCALE}
								style={{ color: colors.textMuted }}
							>
								{subtitle}
							</AppText>
						</View>
					),
					...(Platform.OS === "ios"
						? {}
						: {
								headerRight: () => (
									<SelectionMenu
										trigger="ellipsis"
										label={title}
										accessibilityLabel={title}
										groups={menuGroups}
										onSelect={(id) => void onMenu(id)}
									/>
								),
							}),
				}}
			/>
			{Platform.OS === "ios" ? (
				<>
					<Stack.Toolbar placement="left">
						<Stack.Toolbar.Button
							icon="xmark"
							accessibilityLabel={logged ? text.closeLogged : text.closeKeep}
							onPress={close}
						/>
					</Stack.Toolbar>
					<Stack.Toolbar placement="right">
						<Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={title}>
							<Stack.Toolbar.MenuAction
								icon={
									advanced
										? "slider.horizontal.below.rectangle"
										: "slider.horizontal.3"
								}
								onPress={toggleMode}
							>
								{advanced ? text.modeSimple : text.modeAdvanced}
							</Stack.Toolbar.MenuAction>
							{group ? null : (
								<Stack.Toolbar.MenuAction
									disabled={!valid}
									onPress={() => void onMenu("repeat")}
								>
									{copy.rowRepeat}
								</Stack.Toolbar.MenuAction>
							)}
							{bodyweight ? null : (
								<Stack.Toolbar.MenuAction
									onPress={() => void onMenu("profile")}
								>
									{copy.strengthProfile}
								</Stack.Toolbar.MenuAction>
							)}
							<Stack.Toolbar.MenuAction
								destructive
								disabled={locked}
								onPress={() => void onMenu("delete")}
							>
								{copy.rowDelete}
							</Stack.Toolbar.MenuAction>
						</Stack.Toolbar.Menu>
					</Stack.Toolbar>
				</>
			) : null}
			<View style={[styles.screen, { paddingBottom: keyboard }]}>
				<View collapsable={false} style={styles.scrollHost}>
					<ScrollView
						style={styles.scroll}
						contentContainerStyle={styles.content}
						contentInsetAdjustmentBehavior="automatic"
						keyboardShouldPersistTaps="handled"
					>
						{!advanced ? null : bodyweight ? (
							<AppText variant="secondary" style={{ color: colors.textMuted }}>
								{text.bodyweightNote}
							</AppText>
						) : reference ? (
							<View style={styles.lineRow}>
								<AppText
									variant="secondary"
									style={[styles.lineText, { color: colors.textMuted }]}
								>
									{referenceLine}
								</AppText>
								<Pressable
									accessibilityRole="button"
									hitSlop={8}
									onPress={() => void onMenu("profile")}
								>
									<AppText variant="secondary" style={styles.link}>
										{copy.profile.title} ›
									</AppText>
								</Pressable>
							</View>
						) : levels ? null : (
							<View style={styles.noReference}>
								<View style={styles.lineText}>
									<AppText variant="row" style={{ fontWeight: "600" }}>
										{text.noRefTitle}
									</AppText>
									<AppText
										variant="secondary"
										style={{ color: colors.textMuted }}
									>
										{row.percent !== null
											? row.kg > 0
												? fmt(text.noRefPlan, {
														percent: row.percent,
														load: loadOnly,
													})
												: fmt(text.noRefPlanEmpty, { percent: row.percent })
											: text.noRefSub}
									</AppText>
								</View>
								<Pressable
									accessibilityRole="button"
									hitSlop={8}
									onPress={() => {
										if (actions.blocked()) return;
										router.push({
											pathname: "/session-manual",
											params: {
												sessionId: params.sessionId,
												exerciseId: row.exerciseId,
											},
										});
									}}
								>
									<AppText variant="secondary" style={styles.link}>
										{copy.refEnter}
									</AppText>
								</Pressable>
							</View>
						)}
						{advanced && reference ? (
							<View style={styles.chips}>
								{PRESETS.map((percent) => {
									const on = target === percent;
									const priced = applyPercent(row, percent, reference, facts);
									const chipLoad = formatNumber(
										on ? shownLoad(row) : shownLoad(priced),
										locale,
										row.unit === "lbs" ? 1 : 2,
									);
									return (
										<Pressable
											key={percent}
											accessibilityRole="button"
											accessibilityState={{ selected: on }}
											accessibilityLabel={`${percent}%, ${chipLoad} ${row.unit}`}
											disabled={locked}
											onPress={() => change(priced)}
											style={[
												styles.chip,
												largeText && styles.chipLarge,
												on && styles.chipOn,
											]}
											testID={`session-percent-${percent}`}
										>
											<AppText
												variant="row"
												style={[styles.chipTop, on && styles.chipInk]}
											>
												{percent}%
											</AppText>
											<AppText
												variant="caption"
												style={[styles.chipSub, on && styles.chipInk]}
											>
												{chipLoad}
											</AppText>
										</Pressable>
									);
								})}
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={text.customPercentTitle}
									accessibilityState={{ selected: custom }}
									disabled={locked}
									onPress={() => {
										setPercentText(custom && target ? String(target) : "");
										setCustomOpen((value) => !value);
										requestAnimationFrame(() => percentRef.current?.focus());
									}}
									style={[
										styles.chip,
										largeText && styles.chipLarge,
										custom && styles.chipOn,
									]}
								>
									<AppText
										variant="row"
										numberOfLines={1}
										style={[styles.chipTop, custom && styles.chipInk]}
									>
										{custom && target
											? `${formatNumber(target, locale, 1)}%`
											: text.customPercent.replace(" %", "")}
									</AppText>
									<AppText
										variant="caption"
										style={[styles.chipSub, custom && styles.chipInk]}
									>
										{custom ? formatNumber(shownLoad(row), locale) : "%"}
									</AppText>
								</Pressable>
							</View>
						) : null}
						{advanced && customOpen ? (
							<View style={styles.customRow}>
								<TextInput
									ref={percentRef}
									accessibilityLabel={text.customPercentTitle}
									value={percentText}
									onChangeText={setPercentText}
									keyboardType="decimal-pad"
									onFocus={() => setFocus("percent")}
									onBlur={() => setFocus(null)}
									placeholder={text.percentMax}
									placeholderTextColor={colors.textFaint}
									style={styles.customInput}
								/>
								<Pressable
									accessibilityRole="button"
									onPress={applyCustom}
									style={styles.customApply}
								>
									<AppText variant="control" style={styles.link}>
										{text.apply}
									</AppText>
								</Pressable>
							</View>
						) : null}
						{advanced && levels ? (
							<View style={styles.levels}>
								<View style={styles.lineRow}>
									<AppText
										variant="label"
										style={[styles.lineText, { color: colors.textMuted }]}
									>
										{bodyweightKg
											? fmt(text.levelsTitle, {
													weight: Math.round(bodyweightKg),
												})
											: text.levelsTitleRatio}
									</AppText>
									{bodyweightKg ? (
										<AppText
											variant="label"
											style={{ color: colors.textMuted }}
										>
											{text.levelsHint}
										</AppText>
									) : null}
								</View>
								<View style={styles.levelRow}>
									{levels.map((level, index) => {
										const on = where?.index === index;
										const range =
											level.fromKg !== null
												? level.toKg !== null
													? `${level.fromKg}–${level.toKg}`
													: `${level.fromKg}+`
												: level.to !== null
													? `${formatNumber(level.from, locale)}–${formatNumber(level.to, locale)}×`
													: `${formatNumber(level.from, locale)}×+`;
										const off = !bodyweightKg || locked;
										return (
											<Pressable
												key={level.id}
												accessibilityRole="button"
												accessibilityState={{ selected: on, disabled: off }}
												accessibilityLabel={`${text.levels[level.id]}, ${range}${level.fromKg !== null ? " kg" : ""}`}
												disabled={off}
												onPress={() => {
													if (!bodyweightKg) return;
													const kg = snapLoad(
														startLoadKg(level, bodyweightKg),
														facts.stepKg,
														row.unit,
													);
													change({
														...withTypedLoad(
															row,
															row.unit === "lbs"
																? Math.round(convertLoad(kg, "kg", "lbs"))
																: kg,
														),
														reps: row.reps >= 1 ? row.reps : START_REPS,
														blank: undefined,
													});
												}}
												style={[styles.level, on && styles.levelOn]}
												testID={`session-level-${level.id}`}
											>
												<AppText
													variant="caption"
													numberOfLines={1}
													adjustsFontSizeToFit
													style={{ fontWeight: "700" }}
												>
													{text.levels[level.id]}
												</AppText>
												<AppText
													variant="row"
													numberOfLines={1}
													adjustsFontSizeToFit
													style={styles.chipTop}
												>
													{range}
												</AppText>
											</Pressable>
										);
									})}
								</View>
								<AppText
									variant="secondary"
									style={{ color: colors.textMuted }}
								>
									{levelLine}
								</AppText>
							</View>
						) : null}
						{!advanced && check && note ? (
							<AppText variant="secondary" style={{ color: colors.warn }}>
								{note}
							</AppText>
						) : null}
						{!advanced || bodyweight ? null : (
							<View style={[styles.card, highlight && styles.cardHighlight]}>
								<AppText variant="label" style={{ color: colors.textMuted }}>
									{text.oneRmFromSet}
								</AppText>
								<AppText variant="display" testID="session-editor-one-rm">
									{estimate
										? `${row.reps === 1 ? "" : "≈"}${formatNumber(
												row.reps === 1
													? Math.round(estimate.value * 10) / 10
													: Math.round(estimate.value),
												locale,
											)} kg`
										: "—"}
								</AppText>
								{note ? (
									<AppText
										variant="secondary"
										style={{
											color: check
												? colors.warn
												: highlight
													? colors.accent
													: colors.textMuted,
										}}
									>
										{note}
									</AppText>
								) : null}
							</View>
						)}
						{bodyweight && note ? (
							<AppText variant="secondary" style={{ color: colors.warn }}>
								{note}
							</AppText>
						) : null}
						{advanced && plateLine ? (
							<AppText variant="row" style={{ fontWeight: "600" }}>
								{plateLine}
							</AppText>
						) : null}
						{advanced && planLoad ? (
							<Pressable
								accessibilityRole={onPlan ? undefined : "button"}
								disabled={Boolean(onPlan) || locked}
								onPress={() => change(resetToPlan(row))}
							>
								<AppText
									variant="secondary"
									style={onPlan ? { color: colors.textMuted } : styles.link}
								>
									{fmt(onPlan ? text.onPlan : text.backToPlan, {
										load: planLoad,
									})}
								</AppText>
							</Pressable>
						) : null}
						<View style={styles.section}>
							<AppText variant="label" style={{ color: colors.textMuted }}>
								{text.kindTitle}
							</AppText>
							<Segmented
								options={SET_TYPES.map((kind) => ({
									value: kind,
									label: {
										warmup: text.kindWarmup,
										working: text.kindWorking,
										drop: text.kindDrop,
										failure: text.kindFailure,
									}[kind],
								}))}
								value={row.kind}
								onChange={(kind) => {
									if (!locked) change({ ...row, kind });
								}}
							/>
						</View>
						{advanced ? (
							<View style={styles.moreBody}>
								<View style={styles.section}>
									<View style={styles.lineRow}>
										<AppText
											variant="label"
											style={[styles.lineText, { color: colors.textMuted }]}
										>
											{text.rpeTitle}
										</AppText>
										{row.rpe === null ? null : (
											<AppText
												variant="label"
												style={{ color: colors.textMuted }}
											>
												{fmt(text.rpeLeftShort, {
													count: formatNumber(10 - row.rpe, locale, 1),
												})}
											</AppText>
										)}
									</View>
									<View style={styles.chips}>
										{RPE_CHIPS.map((value) => {
											const on = row.rpe === value;
											return (
												<Pressable
													key={value}
													accessibilityRole="button"
													accessibilityState={{ selected: on }}
													accessibilityLabel={fmt(text.rpeValue, {
														value: formatNumber(value, locale, 1),
													})}
													disabled={locked}
													onPress={() =>
														change({ ...row, rpe: on ? null : value })
													}
													style={[styles.rpeChip, on && styles.chipOn]}
													testID={`session-rpe-${value}`}
												>
													<AppText
														variant="row"
														style={[styles.chipTop, on && styles.chipInk]}
													>
														{formatNumber(value, locale, 1)}
													</AppText>
												</Pressable>
											);
										})}
									</View>
								</View>
								{bodyweight ? null : (
									<Segmented
										options={[
											{ value: "kg", label: text.unitKg },
											{ value: "lbs", label: text.unitLbs },
										]}
										value={row.unit}
										onChange={(unit) => change(switchUnit(row, unit, facts))}
									/>
								)}
								{detail ? (
									<AppText
										variant="secondary"
										style={{ color: colors.textMuted }}
									>
										{detail}
									</AppText>
								) : null}
								{detailReps ? (
									<AppText
										variant="secondary"
										style={{ color: colors.textMuted }}
									>
										{detailReps}
									</AppText>
								) : null}
							</View>
						) : null}
					</ScrollView>
				</View>
				<View
					style={[
						styles.footer,
						{
							paddingBottom:
								keyboard > 0 ? 0 : Math.max(insets.bottom, spacing.sm),
						},
					]}
				>
					<View style={styles.fields}>
						<NumberField
							label={
								bodyweight ? text.added : fmt(text.weight, { unit: row.unit })
							}
							value={loadShown}
							placeholder="—"
							decimal
							inputRef={loadRef}
							disabled={locked}
							testID="session-editor-load"
							onChange={onLoadText}
							onFocus={() => {
								setLoadText(loadShown);
								setFocus("kg");
							}}
							onBlur={() => setFocus(null)}
						/>
						<NumberField
							label={timed ? text.seconds : text.reps}
							value={repsShown}
							placeholder="—"
							decimal={false}
							inputRef={repsRef}
							disabled={locked}
							testID="session-editor-reps"
							onChange={onRepsText}
							onFocus={() => {
								setRepsText(repsShown);
								setFocus("reps");
							}}
							onBlur={() => setFocus(null)}
						/>
					</View>
					{keyboard > 0 ? null : (
						<View style={styles.fields}>
							<View style={styles.stepPair}>
								<StepButton
									label={`−${stepLabel}`}
									spoken={fmt(text.stepDown, { step: stepLabel })}
									disabled={locked}
									onPress={() => change(stepLoad(row, -1, facts))}
								/>
								<StepButton
									label={`+${stepLabel}`}
									spoken={fmt(text.stepUp, { step: stepLabel })}
									disabled={locked}
									onPress={() => change(stepLoad(row, 1, facts))}
								/>
							</View>
							<View style={styles.stepPair}>
								<StepButton
									label={`−${countStep}`}
									spoken={
										timed
											? fmt(text.secondsDown, { step: countStep })
											: text.repsDown
									}
									disabled={locked || row.reps <= 0}
									onPress={() =>
										change({ ...row, reps: Math.max(0, row.reps - countStep) })
									}
								/>
								<StepButton
									label={`+${countStep}`}
									spoken={
										timed
											? fmt(text.secondsUp, { step: countStep })
											: text.repsUp
									}
									disabled={locked}
									onPress={() =>
										change({
											...row,
											reps: row.reps + countStep,
											blank: undefined,
										})
									}
								/>
							</View>
						</View>
					)}
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ disabled: !primaryEnabled }}
						disabled={!primaryEnabled}
						onPress={() => void onPrimary()}
						style={[styles.primary, !primaryEnabled && styles.primaryOff]}
						testID="session-editor-primary"
					>
						<AppText
							variant="control"
							numberOfLines={2}
							style={{
								color: primaryEnabled ? colors.onAccent : colors.textMuted,
								fontWeight: "700",
								textAlign: "center",
							}}
						>
							{primary}
						</AppText>
					</Pressable>
					{keyboard > 0 ? (
						<View style={styles.accessory}>
							<Pressable
								accessibilityRole="button"
								disabled={focus !== "reps"}
								onPress={() => fieldsOrder[0]?.current?.focus()}
								style={styles.accessoryButton}
							>
								<AppText
									variant="control"
									style={{
										color: focus === "reps" ? colors.accent : colors.textFaint,
									}}
								>
									{text.previousField}
								</AppText>
							</Pressable>
							<Pressable
								accessibilityRole="button"
								disabled={focus !== "kg"}
								onPress={() => fieldsOrder[1]?.current?.focus()}
								style={styles.accessoryButton}
							>
								<AppText
									variant="control"
									style={{
										color: focus === "kg" ? colors.accent : colors.textFaint,
									}}
								>
									{text.nextField}
								</AppText>
							</Pressable>
							<View style={styles.accessorySpace} />
							<Pressable
								accessibilityRole="button"
								onPress={() => {
									if (focus === "percent") applyCustom();
									Keyboard.dismiss();
								}}
								style={styles.accessoryButton}
							>
								<AppText variant="control" style={{ color: colors.accent }}>
									{text.fieldDone}
								</AppText>
							</Pressable>
						</View>
					) : null}
				</View>
			</View>
		</>
	);
}
const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		screen: { flex: 1, backgroundColor: colors.bg },
		headerTitle: { alignItems: "center", maxWidth: 240 },
		scrollHost: { flex: 1 },
		scroll: { flex: 1 },
		content: { padding: spacing.md, gap: spacing.md },
		lineRow: {
			flexDirection: "row",
			alignItems: "center",
			flexWrap: "wrap",
			gap: spacing.sm,
		},
		lineText: { flex: 1, minWidth: 160 },
		noReference: {
			flexDirection: "row",
			flexWrap: "wrap",
			alignItems: "center",
			gap: spacing.sm,
			padding: spacing.md,
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
		},
		link: { color: colors.accent, fontWeight: "600" },
		chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
		chip: {
			flexGrow: 1,
			flexBasis: "22%",
			minHeight: 56,
			alignItems: "center",
			justifyContent: "center",
			paddingVertical: spacing.xs,
			paddingHorizontal: 4,
			backgroundColor: colors.surface2,
			borderRadius: radius.lg,
			borderCurve: "continuous",
		},
		chipLarge: { flexBasis: "46%" },
		chipOn: { backgroundColor: colors.accentFill },
		chipTop: { fontWeight: "700", fontVariant: ["tabular-nums"] },
		chipSub: { color: colors.textMuted, fontVariant: ["tabular-nums"] },
		chipInk: { color: colors.onAccent },
		customRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
		customInput: {
			flex: 1,
			minHeight: 48,
			paddingHorizontal: spacing.md,
			backgroundColor: colors.surface2,
			borderRadius: radius.lg,
			color: colors.text,
		},
		customApply: {
			minHeight: 48,
			minWidth: 64,
			alignItems: "center",
			justifyContent: "center",
		},
		card: {
			padding: spacing.md,
			gap: 2,
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
		},
		cardHighlight: { backgroundColor: colors.accentDim },
		moreBody: { gap: spacing.md },
		section: { gap: spacing.xs },
		rpeChip: {
			flexGrow: 1,
			minWidth: 44,
			minHeight: 44,
			alignItems: "center",
			justifyContent: "center",
			paddingHorizontal: spacing.xs,
			backgroundColor: colors.surface2,
			borderRadius: radius.pill,
		},
		levels: { gap: spacing.xs },
		levelRow: { flexDirection: "row", gap: spacing.xs },
		level: {
			flex: 1,
			minWidth: 0,
			minHeight: 56,
			alignItems: "center",
			justifyContent: "center",
			paddingHorizontal: 2,
			borderRadius: radius.lg,
			borderCurve: "continuous",
			borderWidth: 1,
			borderColor: colors.border,
		},
		levelOn: {
			borderWidth: 2,
			borderColor: colors.accentFill,
			backgroundColor: colors.accentDim,
		},
		footer: {
			paddingHorizontal: spacing.md,
			paddingTop: spacing.sm,
			gap: spacing.xs,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
			backgroundColor: colors.bg,
		},
		fields: { flexDirection: "row", gap: spacing.sm },
		fieldColumn: { flex: 1, minWidth: 0, gap: 4 },
		fieldLabel: { textAlign: "center", color: colors.textMuted },
		field: {
			minHeight: 64,
			textAlign: "center",
			color: colors.text,
			backgroundColor: colors.surface2,
			borderRadius: radius.lg,
			borderCurve: "continuous",
			...type.quantityCompact,
			fontVariant: ["tabular-nums"],
			padding: 0,
		},
		stepPair: { flex: 1, flexDirection: "row", gap: spacing.xs },
		step: {
			flex: 1,
			minHeight: 48,
			alignItems: "center",
			justifyContent: "center",
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: radius.lg,
			borderCurve: "continuous",
		},
		pressed: { opacity: opacity.pressed },
		dimmed: { opacity: opacity.disabled },
		primary: {
			minHeight: 56,
			alignItems: "center",
			justifyContent: "center",
			paddingHorizontal: spacing.md,
			backgroundColor: colors.accentFill,
			borderRadius: radius.pill,
		},
		primaryOff: { backgroundColor: colors.surface2 },
		accessory: {
			marginHorizontal: -spacing.md,
			flexDirection: "row",
			alignItems: "center",
			paddingHorizontal: spacing.xs,
			backgroundColor: colors.surface2,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		accessoryButton: {
			minHeight: 44,
			minWidth: 44,
			paddingHorizontal: spacing.sm,
			alignItems: "center",
			justifyContent: "center",
		},
		accessorySpace: { flex: 1 },
	});
