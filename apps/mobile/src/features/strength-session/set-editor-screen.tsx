/**
 * The set editor. Open sets change in place, so a closed sheet or a restart
 * keeps the input; a logged set's changes stay a draft until Save.
 */
import { calcPlates, DEFAULT_BAR } from "@foundry/core";
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
import type { Id } from "../../convex/api";
import { fmt, useI18n } from "../../i18n";
import {
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
import { useRestState } from "./components/rest-timer";
import { useLargeText } from "./components/session-set-row";
import { useChoice, useSessionActions } from "./data/session-actions";
import { useSessionWorkspace, workspaceStore } from "./data/session-workspace";
import {
	formatClock,
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
	MAX_LOAD_KG,
	MAX_REPS,
	type PlanSet,
	referenceFor,
	repeatRow,
	resetToPlan,
	rowOneRepMax,
	rowsOf,
	type SetKind,
	sameSet,
	shownLoad,
	stepLoad,
	switchUnit,
	targetPercent,
	typoCheck,
	updateRow,
	withTypedLoad,
} from "./session-plan";

const PRESETS = [60, 65, 70, 75, 80, 85, 90];
const KINDS: SetKind[] = ["warmup", "working", "drop", "failure"];
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
type FieldRef = RefObject<ComponentRef<typeof TextInput> | null>;
const parseNumber = (text: string) => Number(text.replace(",", "."));

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
	const [more, setMore] = useState(false);
	const [keyboard, setKeyboard] = useState(0);
	const loadRef = useRef<ComponentRef<typeof TextInput>>(null);
	const repsRef = useRef<ComponentRef<typeof TextInput>>(null);
	const percentRef = useRef<ComponentRef<typeof TextInput>>(null);
	useEffect(() => {
		const show = Keyboard.addListener(
			Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
			(event) => setKeyboard(event.endCoordinates.height),
		);
		const hide = Keyboard.addListener(
			Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
			() => setKeyboard(0),
		);
		return () => {
			show.remove();
			hide.remove();
		};
	}, []);
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
	const estimate = rowOneRepMax(row, bodyweight);
	const target = targetPercent(row, reference, facts.stepKg);
	const custom = target !== null && !PRESETS.includes(target);
	const clockIdle =
		group?.mode === "amrap" && group.state === "idle" && !logged;
	const fullLoad = formatSetFull(row, bodyweight, locale);
	const loadOnly = formatLoadOnly(row, bodyweight, locale);

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
				bodyweight,
				locale,
			)
		: null;
	const onPlan =
		row.plan && near(row.plan.kg, row.kg) && row.plan.reps === row.reps;

	const kindLabel = {
		warmup: text.kindWarmup,
		working: text.kindWorking,
		drop: text.kindDrop,
		failure: text.kindFailure,
	}[row.kind];
	const rpeSummary =
		row.rpe === null
			? text.noRpe
			: fmt(text.rpeValue, { value: formatNumber(row.rpe, locale, 1) });
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
	const theory = (value: number) => Math.floor(30 * (value / row.kg - 1));
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
						bodyweight,
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
		primary = focus === "kg" ? text.enterLoad : text.enterReps;
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
						? text.enterReps
						: row.kg > MAX_LOAD_KG
							? text.checkLoad
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
	const loadStep = row.unit === "lbs" ? 5 : facts.stepKg;
	const stepLabel = formatNumber(loadStep, locale);
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
				reps: Math.min(parsed, MAX_REPS + 1),
				blank: undefined,
			});
	};
	const menuGroups = [
		{
			options: [
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
					disabled: sending,
				},
			],
		},
	];
	async function onMenu(id: string) {
		if (!row) return;
		if (id === "repeat") {
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
		if (reference && Number.isFinite(value) && value > 0 && value <= 120) {
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
				<ScrollView
					style={styles.scroll}
					contentContainerStyle={styles.content}
					contentInsetAdjustmentBehavior="automatic"
					keyboardShouldPersistTaps="handled"
				>
					{bodyweight ? (
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
					) : (
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
					{reference ? (
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
					{bodyweight ? null : (
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
					{plateLine ? (
						<AppText variant="row" style={{ fontWeight: "600" }}>
							{plateLine}
						</AppText>
					) : null}
					{planLoad ? (
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
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ expanded: more }}
						onPress={() => setMore((value) => !value)}
						style={styles.moreRow}
						testID="session-editor-more"
					>
						<AppText variant="row" style={{ fontWeight: "600" }}>
							{more ? text.less : text.more}
						</AppText>
						<AppText variant="secondary" style={{ color: colors.textMuted }}>
							{fmt(text.moreSummary, { kind: kindLabel, rpe: rpeSummary })}
						</AppText>
					</Pressable>
					{more ? (
						<View style={styles.moreBody}>
							<View style={styles.rpeRow}>
								<View style={styles.lineText}>
									<AppText variant="row">
										{row.rpe === null
											? text.rpeNone
											: fmt(text.rpeValue, {
													value: formatNumber(row.rpe, locale, 1),
												})}
										{row.rpe === null
											? ""
											: fmt(text.rpeLeft, {
													count: formatNumber(10 - row.rpe, locale, 1),
												})}
									</AppText>
								</View>
								<StepButton
									label="−"
									spoken={
										row.rpe !== null && row.rpe <= 6
											? text.rpeClear
											: text.rpeLower
									}
									disabled={locked || row.rpe === null}
									onPress={() =>
										change({
											...row,
											rpe:
												row.rpe === null || row.rpe <= 6 ? null : row.rpe - 0.5,
										})
									}
								/>
								<StepButton
									label="+"
									spoken={text.rpeRaise}
									disabled={locked || row.rpe === 10}
									onPress={() =>
										change({
											...row,
											rpe: row.rpe === null ? 8 : Math.min(10, row.rpe + 0.5),
										})
									}
								/>
							</View>
							<View style={styles.kinds}>
								{KINDS.map((kind) => (
									<Pressable
										key={kind}
										accessibilityRole="button"
										accessibilityState={{ selected: row.kind === kind }}
										disabled={locked}
										onPress={() => change({ ...row, kind })}
										style={[styles.kind, row.kind === kind && styles.kindOn]}
									>
										<AppText
											variant="secondary"
											style={{
												color: row.kind === kind ? colors.bg : colors.text,
												fontWeight: "600",
											}}
										>
											{
												{
													warmup: text.kindWarmup,
													working: text.kindWorking,
													drop: text.kindDrop,
													failure: text.kindFailure,
												}[kind]
											}
										</AppText>
									</Pressable>
								))}
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
							<Pressable
								accessibilityRole="button"
								accessibilityState={{ disabled: sending }}
								disabled={sending}
								onPress={() => void onMenu("delete")}
								style={[styles.deleteRow, sending && styles.primaryOff]}
							>
								<AppText variant="control" style={{ color: colors.danger }}>
									{copy.rowDelete}
								</AppText>
							</Pressable>
						</View>
					) : null}
				</ScrollView>
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
							label={text.reps}
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
									label="−1"
									spoken={text.repsDown}
									disabled={locked || row.reps <= 0}
									onPress={() =>
										change({ ...row, reps: Math.max(0, row.reps - 1) })
									}
								/>
								<StepButton
									label="+1"
									spoken={text.repsUp}
									disabled={locked}
									onPress={() =>
										change({ ...row, reps: row.reps + 1, blank: undefined })
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
		moreRow: {
			minHeight: 48,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			flexWrap: "wrap",
			gap: spacing.xs,
		},
		moreBody: { gap: spacing.md },
		rpeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
		kinds: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
		kind: {
			minHeight: 44,
			justifyContent: "center",
			paddingHorizontal: spacing.md,
			backgroundColor: colors.surface2,
			borderRadius: radius.pill,
		},
		kindOn: { backgroundColor: colors.text },
		deleteRow: { minHeight: 48, justifyContent: "center" },
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
		pressed: { opacity: 0.6 },
		dimmed: { opacity: 0.4 },
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
