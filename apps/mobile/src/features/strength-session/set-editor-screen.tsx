/**
 * The set editor. Open sets change in place, so a closed sheet or a restart
 * keeps the input; a logged set's changes stay a draft until Save.
 */
import {
	calcPlates,
	convertLoad,
	countStep as countStepFor,
	DEFAULT_BAR,
	estimatedMaxReps,
	formatClock,
	SET_LIMITS,
	SET_NOTE_LENGTH,
	SET_TYPES,
	toKg,
} from "@foundry/core";
import {
	Stack,
	useLocalSearchParams,
	useNavigation,
	usePreventRemove,
	useRouter,
} from "expo-router";
import { SymbolView } from "expo-symbols";
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
import { dayLabel } from "../../data/session-data";
import {
	dateLocale,
	fmt,
	type Locale,
	parseLocalizedDecimal,
	useI18n,
} from "../../i18n";
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
import { useCompactPhone } from "./components/now-card";
import {
	previousSetOf,
	previousSetsOf,
	usePreviousSession,
} from "./data/previous-session";
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
	chipPercentOf,
	confirmKey,
	findRow,
	groupOfRow,
	isValidRow,
	loadStep,
	noteOf,
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
	withStoredNote,
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

type ValueSize = "valueHero" | "valueLarge" | "valueMedium" | "valueCompact";
type Step = { spoken: string; disabled: boolean; onPress: () => void };

/** A big editable value with its − and + steppers under it. */
function ValueCard({
	label,
	value,
	decimal,
	size,
	inputRef,
	onChange,
	onFocus,
	onBlur,
	disabled,
	steps,
	testID,
}: {
	label: string;
	value: string;
	decimal: boolean;
	size: ValueSize;
	inputRef: FieldRef;
	onChange: (text: string) => void;
	onFocus: () => void;
	onBlur: () => void;
	disabled: boolean;
	steps: readonly [Step, Step] | null;
	testID: string;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const compact = useCompactPhone();
	return (
		<View style={styles.valueCard}>
			<AppText
				variant="overline"
				numberOfLines={1}
				adjustsFontSizeToFit
				minimumFontScale={0.6}
				style={styles.valueLabel}
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
				placeholder="—"
				placeholderTextColor={colors.textFaint}
				maxFontSizeMultiplier={1.2}
				style={[styles.valueInput, type[size]]}
				testID={testID}
			/>
			{steps ? (
				<View style={styles.stepRow}>
					{steps.map((step, index) => (
						<Pressable
							key={step.spoken}
							accessibilityRole="button"
							accessibilityLabel={step.spoken}
							disabled={step.disabled}
							onPress={step.onPress}
							style={({ pressed }) => [
								styles.step,
								compact && styles.stepCompact,
								pressed && styles.pressed,
								step.disabled && styles.dimmed,
							]}
						>
							<SymbolView
								name={index === 0 ? "minus" : "plus"}
								size={20}
								weight="bold"
								tintColor={colors.text}
							/>
						</Pressable>
					))}
				</View>
			) : null}
		</View>
	);
}
/** The sheet's header has a fixed height, so its title scales only so far. */
const NAV_TITLE_MAX_SCALE = 1.3;

const shortDay = (time: number, locale: Locale) =>
	new Date(time)
		.toLocaleDateString(dateLocale(locale), { day: "numeric", month: "short" })
		.replace(".", "");

/** "Last time 80 × 8 @ RPE 8 · 11 Nov": the set this one follows. */
function lastLine(
	last: { kg: number; reps: number; rpe?: number | null; date?: number | null },
	text: { previous: string; previousRpe: string; previousDate: string },
	locale: Locale,
	format: (set: { kg: number; reps: number }) => string,
	todayLabel: string,
) {
	const load = format(last);
	const line =
		typeof last.rpe === "number"
			? fmt(text.previousRpe, { load, rpe: formatNumber(last.rpe, locale, 1) })
			: fmt(text.previous, { load });
	if (typeof last.date !== "number") return line;
	const date = dayLabel(last.date, todayLabel, (time) =>
		shortDay(time, locale),
	);
	return fmt(text.previousDate, { line, date });
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
	const copy = t.strength.plan;
	const text = copy.editor;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const choose = useChoice();
	const restState = useRestState();
	const stored = plan ? findRow(plan, params.rowId) : undefined;
	// An edit only ever applies to a set that is still logged.
	const saved = stored?.done ? drafts[params.rowId] : undefined;
	const draft = saved && stored ? withStoredNote(saved, stored) : undefined;
	const row = draft ?? stored;
	const facts = row ? getFacts(row.exerciseId) : null;
	const previous = usePreviousSession(workspace.own ? workspace.session : null);
	const previousSets = previous?.sets ?? null;
	// The same set last time: same kind, same place among this exercise's sets.
	const position =
		plan && row
			? rowsOf(plan, row.exerciseId)
					.filter(
						(item) => (item.kind === "warmup") === (row.kind === "warmup"),
					)
					.findIndex((item) => item.id === row.id) + 1
			: 0;
	const matched =
		previousSets && row
			? previousSetOf(
					previousSets,
					row.exerciseId,
					Math.max(1, position),
					row.kind === "warmup",
				)
			: null;
	const history =
		previousSets && row ? previousSetsOf(previousSets, row.exerciseId) : [];
	const [focus, setFocus] = useState<"kg" | "reps" | "percent" | "note" | null>(
		null,
	);
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
	const compact = useCompactPhone();
	const valueSize: ValueSize = compact
		? advanced
			? "valueCompact"
			: "valueMedium"
		: advanced
			? "valueLarge"
			: "valueHero";
	const loadRef = useRef<ComponentRef<typeof TextInput>>(null);
	const repsRef = useRef<ComponentRef<typeof TextInput>>(null);
	const percentRef = useRef<ComponentRef<typeof TextInput>>(null);
	const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
	useEffect(() => {
		// The note sits at the end, so the keyboard would cover it.
		if (focus !== "note" || keyboard === 0) return;
		const frame = requestAnimationFrame(() =>
			scrollRef.current?.scrollToEnd({ animated: true }),
		);
		return () => cancelAnimationFrame(frame);
	}, [focus, keyboard]);
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
	const countStep = countStepFor(facts.timed);
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
	// The simple view has no note field, but never hides a note there is.
	const showNote =
		advanced ||
		focus === "note" ||
		noteOf(row) !== "" ||
		Boolean(stored && noteOf(stored));
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
	// The chip that matches the weight: the planned percentage, else what the
	// weight is of the 1RM, so 83% or 100% lights the custom chip (APP-624).
	const chipPercent = chipPercentOf(row, target, reference, bodyweight);
	const custom = chipPercent !== null && !PRESETS.includes(chipPercent);
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
			note = fmt(text.noteRecord, { value: Math.round(others.estimated) });
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
		!bodyweight &&
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
		source:
			reference?.source === "manual" ? text.sourceManual : text.sourceMeasured,
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
						source: detailValues.source,
						estimated: theory(others.estimated),
					})
				: reference && theory(reference.value) >= 1
					? fmt(text.detailRepsMeasured, {
							measured: theory(reference.value),
							source: detailValues.source,
						})
					: others.estimated && theory(others.estimated) >= 1
						? fmt(text.detailRepsEstimated, {
								estimated: theory(others.estimated),
							})
						: "";
	// A warm-up never borrows last time's work set.
	const lastSet = matched ?? (row?.kind === "warmup" ? null : facts.last);
	const previousLine = logged
		? text.loggedSub
		: lastSet
			? lastLine(
					lastSet,
					text,
					locale,
					(last) => formatSetShort({ ...last, unit: "kg" }, facts, locale),
					copy.now.today,
				)
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
				? fmt(timed ? text.confirmSeconds : text.confirmReps, {
						reps: row.reps,
					})
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
	const otherUnit = row.unit === "kg" ? "lbs" : "kg";
	const menuGroups = [
		{
			title: text.viewTitle,
			options: [
				{ id: "simple", label: text.viewSimple, selected: !advanced },
				{ id: "advanced", label: text.viewAdvanced, selected: advanced },
			],
		},
		{
			options: [
				...(bodyweight
					? []
					: [{ id: "unit", label: fmt(text.unitMenu, { unit: row.unit }) }]),
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
		if (!row || !facts) return;
		if (id === "simple" || id === "advanced") {
			if ((id === "advanced") !== advanced) toggleMode();
		} else if (id === "unit") change(switchUnit(row, otherUnit, facts));
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
							<Stack.Toolbar.Menu inline title={text.viewTitle}>
								<Stack.Toolbar.MenuAction
									isOn={!advanced}
									subtitle={text.viewSimpleSub}
									onPress={() => void onMenu("simple")}
								>
									{text.viewSimple}
								</Stack.Toolbar.MenuAction>
								<Stack.Toolbar.MenuAction
									isOn={advanced}
									subtitle={text.viewAdvancedSub}
									onPress={() => void onMenu("advanced")}
								>
									{text.viewAdvanced}
								</Stack.Toolbar.MenuAction>
							</Stack.Toolbar.Menu>
							{bodyweight ? null : (
								<Stack.Toolbar.MenuAction
									disabled={locked}
									onPress={() => void onMenu("unit")}
								>
									{fmt(text.unitMenu, { unit: row.unit })}
								</Stack.Toolbar.MenuAction>
							)}
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
						ref={scrollRef}
						style={styles.scroll}
						contentContainerStyle={[
							styles.content,
							compact && styles.contentCompact,
						]}
						contentInsetAdjustmentBehavior="automatic"
						keyboardShouldPersistTaps="handled"
					>
						<View style={styles.values}>
							<ValueCard
								label={
									bodyweight ? text.added : fmt(text.weight, { unit: row.unit })
								}
								value={loadShown}
								decimal
								size={valueSize}
								inputRef={loadRef}
								disabled={locked}
								testID="session-editor-load"
								onChange={onLoadText}
								onFocus={() => {
									setLoadText(loadShown);
									setFocus("kg");
								}}
								onBlur={() => setFocus(null)}
								steps={
									keyboard > 0
										? null
										: [
												{
													spoken: fmt(text.stepDown, { step: stepLabel }),
													disabled: locked,
													onPress: () => change(stepLoad(row, -1, facts)),
												},
												{
													spoken: fmt(text.stepUp, { step: stepLabel }),
													disabled: locked,
													onPress: () => change(stepLoad(row, 1, facts)),
												},
											]
								}
							/>
							<ValueCard
								label={timed ? text.seconds : text.reps}
								value={repsShown}
								decimal={false}
								size={valueSize}
								inputRef={repsRef}
								disabled={locked}
								testID="session-editor-reps"
								onChange={onRepsText}
								onFocus={() => {
									setRepsText(repsShown);
									setFocus("reps");
								}}
								onBlur={() => setFocus(null)}
								steps={
									keyboard > 0
										? null
										: [
												{
													spoken: timed
														? fmt(text.secondsDown, { step: countStep })
														: text.repsDown,
													disabled: locked || row.reps <= 0,
													onPress: () =>
														change({
															...row,
															reps: Math.max(0, row.reps - countStep),
														}),
												},
												{
													spoken: timed
														? fmt(text.secondsUp, { step: countStep })
														: text.repsUp,
													disabled: locked,
													onPress: () =>
														change({
															...row,
															reps: row.reps + countStep,
															blank: undefined,
														}),
												},
											]
								}
							/>
						</View>
						{!advanced && keyboard === 0 && history.length > 0 && previous ? (
							<View style={styles.history} testID="session-editor-history">
								<AppText variant="overline" style={styles.sectionTitle}>
									{fmt(text.lastTimeTitle, {
										date: dayLabel(previous.date, copy.now.today, (time) =>
											shortDay(time, locale),
										),
									})}
								</AppText>
								{history.map((set, index) => {
									const warm = set.setType === "warmup";
									const number = history
										.slice(0, index + 1)
										.filter(
											(item) => (item.setType === "warmup") === warm,
										).length;
									const same =
										warm === (row.kind === "warmup") &&
										number === Math.max(1, position);
									return (
										<View
											key={set._id}
											style={[styles.historyRow, same && styles.historyRowOn]}
										>
											<AppText
												variant="secondary"
												style={{ color: colors.textMuted }}
											>
												{warm
													? text.lastTimeWarmup
													: fmt(text.lastTimeSet, { number })}
											</AppText>
											<AppText variant="body" style={styles.historyValue}>
												{typeof set.rpe === "number"
													? fmt(text.lastTimeRpe, {
															load: formatSetShort(
																{
																	kg: toKg(set.weight, set.unit),
																	reps: set.reps,
																	unit: "kg",
																},
																facts,
																locale,
															),
															rpe: formatNumber(set.rpe, locale, 1),
														})
													: formatSetShort(
															{
																kg: toKg(set.weight, set.unit),
																reps: set.reps,
																unit: "kg",
															},
															facts,
															locale,
														)}
											</AppText>
										</View>
									);
								})}
							</View>
						) : null}
						{!advanced ? null : bodyweight ? (
							<AppText variant="secondary" style={{ color: colors.textMuted }}>
								{timed ? text.holdNote : text.bodyweightNote}
							</AppText>
						) : (
							<View style={[styles.insight, highlight && styles.insightOn]}>
								<View
									style={[
										styles.insightTile,
										highlight && styles.insightTileOn,
									]}
								>
									<SymbolView
										name={highlight ? "arrow.up" : "function"}
										size={18}
										weight="bold"
										tintColor={highlight ? colors.onAccent : colors.textMuted}
									/>
								</View>
								<View style={styles.lineText}>
									<AppText
										variant="row"
										style={{ fontWeight: "800" }}
										testID="session-editor-one-rm"
									>
										{estimate
											? fmt(
													row.reps === 1
														? text.insightMeasured
														: text.insightEstimate,
													{
														value: formatNumber(
															row.reps === 1
																? Math.round(estimate.value * 10) / 10
																: Math.round(estimate.value),
															locale,
														),
													},
												)
											: `${text.oneRmFromSet} · —`}
									</AppText>
									{note ? (
										<AppText
											variant="secondary"
											style={{ color: check ? colors.warn : colors.textMuted }}
										>
											{note}
										</AppText>
									) : null}
								</View>
							</View>
						)}
						{!advanced || bodyweight || reference || levels ? null : (
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
						{advanced && reference && !bodyweight ? (
							<View style={styles.section}>
								<View style={styles.sectionHead}>
									<AppText variant="label" style={styles.sectionTitle}>
										{text.percentTitle}
									</AppText>
									<Pressable
										accessibilityRole="button"
										accessibilityLabel={`${fmt(text.percentRef, {
											value: formatNumber(
												Math.round(reference.value * 10) / 10,
												locale,
											),
											source:
												reference.source === "manual"
													? text.refManual
													: text.refMeasured,
										})}, ${copy.strengthProfile}`}
										hitSlop={8}
										onPress={() => void onMenu("profile")}
									>
										<AppText variant="label" style={styles.sectionAside}>
											{fmt(text.percentRef, {
												value: formatNumber(
													Math.round(reference.value * 10) / 10,
													locale,
												),
												source:
													reference.source === "manual"
														? text.refManual
														: text.refMeasured,
											})}
										</AppText>
									</Pressable>
								</View>
								<ScrollView
									horizontal
									showsHorizontalScrollIndicator={false}
									keyboardShouldPersistTaps="handled"
									contentContainerStyle={styles.chipRow}
									style={styles.chipScroll}
								>
									{PRESETS.map((percent) => {
										const priced = applyPercent(row, percent, reference, facts);
										const on =
											chipPercent === percent && near(priced.kg, row.kg);
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
												style={[styles.chip, on && styles.chipOn]}
												testID={`session-percent-${percent}`}
											>
												<AppText
													variant="row"
													style={[styles.chipTop, on && styles.chipInk]}
												>
													{percent}%
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
											setPercentText(
												custom && chipPercent ? String(chipPercent) : "",
											);
											setCustomOpen((value) => !value);
											requestAnimationFrame(() => percentRef.current?.focus());
										}}
										style={[styles.chip, custom && styles.chipOn]}
									>
										<AppText
											variant="row"
											numberOfLines={1}
											style={[styles.chipTop, custom && styles.chipInk]}
										>
											{custom && chipPercent
												? `${formatNumber(chipPercent, locale, 1)}%`
												: text.customPercent}
										</AppText>
									</Pressable>
								</ScrollView>
								{customOpen ? (
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
								{referenceLine ? (
									<AppText
										variant="caption"
										style={{ color: colors.textMuted }}
									>
										{referenceLine}
									</AppText>
								) : null}
							</View>
						) : null}
						{advanced && levels ? (
							<View style={styles.section}>
								<View style={styles.sectionHead}>
									<AppText variant="label" style={styles.sectionTitle}>
										{bodyweightKg
											? fmt(text.levelsTitle, {
													weight: Math.round(bodyweightKg),
												})
											: text.levelsTitleRatio}
									</AppText>
									{bodyweightKg ? (
										<AppText variant="label" style={styles.sectionAside}>
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
						{advanced ? (
							<View style={styles.section}>
								<View style={styles.sectionHead}>
									<AppText variant="label" style={styles.sectionTitle}>
										{text.rpeTitle}
									</AppText>
									{row.rpe === null ? null : (
										<AppText variant="label" style={styles.sectionAside}>
											{10 - row.rpe === 1
												? text.rpeLeftShortOne
												: fmt(text.rpeLeftShort, {
														count: formatNumber(10 - row.rpe, locale, 1),
													})}
										</AppText>
									)}
								</View>
								<ScrollView
									horizontal
									showsHorizontalScrollIndicator={false}
									contentContainerStyle={styles.chipRow}
									style={styles.chipScroll}
								>
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
												style={[
													styles.chip,
													styles.rpeChip,
													on && styles.chipOn,
												]}
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
								</ScrollView>
							</View>
						) : null}
						{!advanced && check && note ? (
							<AppText variant="secondary" style={{ color: colors.warn }}>
								{note}
							</AppText>
						) : null}
						{bodyweight && note ? (
							<AppText variant="secondary" style={{ color: colors.warn }}>
								{note}
							</AppText>
						) : null}
						<Segmented
							maxSegments={4}
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
						{showNote ? (
							<View style={styles.note}>
								<SymbolView
									name="pencil"
									size={16}
									tintColor={colors.textFaint}
								/>
								<TextInput
									accessibilityLabel={text.setNote}
									value={row.notes ?? ""}
									onChangeText={(notes) =>
										change({
											...row,
											notes,
											...(logged ? { notesEdited: true } : {}),
										})
									}
									onFocus={() => setFocus("note")}
									onBlur={() => setFocus(null)}
									editable={!locked}
									multiline
									submitBehavior="blurAndSubmit"
									returnKeyType="done"
									maxLength={SET_NOTE_LENGTH}
									placeholder={text.setNotePlaceholder}
									placeholderTextColor={colors.textFaint}
									style={[type.secondary, styles.noteInput]}
									testID="session-editor-note"
								/>
							</View>
						) : null}
						{advanced && plateLine ? (
							<AppText variant="secondary" style={{ color: colors.textMuted }}>
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
						{advanced && detail ? (
							<AppText variant="caption" style={{ color: colors.textMuted }}>
								{detail}
							</AppText>
						) : null}
						{advanced && detailReps ? (
							<AppText variant="caption" style={{ color: colors.textMuted }}>
								{detailReps}
							</AppText>
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
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ disabled: !primaryEnabled }}
						disabled={!primaryEnabled}
						onPress={() => void onPrimary()}
						style={({ pressed }) => [
							styles.primary,
							!primaryEnabled && styles.primaryOff,
							pressed && styles.pressed,
						]}
						testID="session-editor-primary"
					>
						{primaryEnabled && !sending ? (
							<SymbolView
								name="checkmark"
								size={18}
								weight="bold"
								tintColor={colors.onAccent}
							/>
						) : null}
						<AppText
							variant="heading"
							numberOfLines={2}
							style={{
								color: primaryEnabled ? colors.onAccent : colors.textMuted,
								textAlign: "center",
								flexShrink: 1,
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
		content: {
			flexGrow: 1,
			paddingHorizontal: spacing.md,
			paddingTop: 10,
			paddingBottom: spacing.md,
			gap: 14,
		},
		contentCompact: { gap: spacing.sm },
		values: { flexDirection: "row", gap: spacing.sm + 4 },
		// The simple view has nothing under the values, so they take the room.
		history: {
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
			paddingHorizontal: 16,
			paddingVertical: 12,
			gap: 2,
		},
		historyRow: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
			minHeight: 36,
			paddingHorizontal: 10,
			marginHorizontal: -10,
			borderRadius: 12,
		},
		historyRowOn: { backgroundColor: colors.accentDim },
		historyValue: { fontVariant: ["tabular-nums"] },
		valueCard: {
			flex: 1,
			minWidth: 0,
			alignItems: "center",
			justifyContent: "space-evenly",
			gap: spacing.xs,
			paddingTop: 14,
			paddingHorizontal: 10,
			paddingBottom: 12,
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
		},
		valueLabel: { color: colors.textMuted, textAlign: "center" },
		valueInput: {
			alignSelf: "stretch",
			textAlign: "center",
			color: colors.text,
			fontVariant: ["tabular-nums"],
			padding: 0,
		},
		stepRow: { flexDirection: "row", gap: spacing.xs + 4 },
		step: {
			width: 60,
			height: 52,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: 26,
			backgroundColor: colors.surface3,
		},
		stepCompact: { width: 52, height: 44, borderRadius: 22 },
		insight: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			paddingVertical: spacing.sm,
			paddingHorizontal: 14,
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
		},
		insightOn: { backgroundColor: colors.accentDim },
		insightTile: {
			width: 36,
			height: 36,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: 10,
			backgroundColor: colors.surface3,
		},
		insightTileOn: { backgroundColor: colors.accentFill },
		lineText: { flex: 1, minWidth: 0 },
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
		section: { gap: spacing.xs + 2 },
		sectionHead: {
			flexDirection: "row",
			alignItems: "flex-end",
			justifyContent: "space-between",
			flexWrap: "wrap",
			gap: spacing.sm,
		},
		sectionTitle: { flexShrink: 1, color: colors.textMuted },
		sectionAside: { color: colors.textMuted, textAlign: "right" },
		chipScroll: { marginHorizontal: -spacing.md },
		chipRow: { gap: spacing.xs + 2, paddingHorizontal: spacing.md },
		chip: {
			minWidth: 60,
			height: 40,
			alignItems: "center",
			justifyContent: "center",
			paddingHorizontal: 14,
			borderRadius: 20,
			borderWidth: 1,
			borderColor: colors.borderStrong,
		},
		rpeChip: { minWidth: 48 },
		chipOn: {
			backgroundColor: colors.accentFill,
			borderColor: colors.accentFill,
		},
		chipTop: { fontWeight: "700", fontVariant: ["tabular-nums"] },
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
			borderColor: colors.borderStrong,
		},
		levelOn: {
			borderWidth: 2,
			borderColor: colors.accentFill,
			backgroundColor: colors.accentDim,
		},
		note: {
			minHeight: 44,
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			paddingHorizontal: 14,
			borderRadius: radius.lg,
			borderCurve: "continuous",
			borderWidth: 1,
			borderColor: colors.borderStrong,
		},
		noteInput: {
			flex: 1,
			minWidth: 0,
			maxHeight: 132,
			paddingVertical: spacing.sm,
			color: colors.text,
		},
		footer: {
			paddingHorizontal: spacing.md,
			paddingTop: 10,
			gap: spacing.xs,
			backgroundColor: colors.bg,
		},
		pressed: { opacity: opacity.pressed },
		dimmed: { opacity: opacity.disabled },
		primary: {
			minHeight: 56,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: spacing.sm,
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
