/** The live strength session: one table per exercise, one tap to log. */
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Id } from "../../convex/api";
import { useQuery } from "../../convex/query-cache";
import { haptics } from "../../feedback/haptics";
import { fmt, plural, useI18n } from "../../i18n";
import { HostedSessionPanel } from "../../screens/hosted-session-panel";
import { radius, spacing, useTokens } from "../../theme";
import { SelectionMenu } from "../../ui/selection-menu";
import { AppText } from "../../ui/text";
import { useToast } from "../../ui/toast";
import { useRestTimer } from "./components/rest-timer";
import { cancelClockAlerts, SessionDock } from "./components/session-dock";
import { SessionExerciseBlock } from "./components/session-exercise-block";
import { SessionExercisePicker } from "./components/session-exercise-picker";
import { SessionGroupBlock } from "./components/session-group-block";
import { SessionRecap } from "./components/session-recap";
import { useChoice, useSessionActions } from "./data/session-actions";
import {
	useSessionSync,
	useSessionWorkspace,
	workspaceStore,
} from "./data/session-workspace";
import { useSetDrafts } from "./data/set-drafts";
import { formatClock } from "./session-format";
import {
	allRows,
	closeOpenClocks,
	findRow,
	loggedCount,
	openCount,
	recapOf,
	sessionExercises,
	unsavedEdits,
} from "./session-plan";
import {
	type PickerRequest,
	SessionScreenContext,
	type SessionScreenValue,
} from "./session-screen-context";

const REST_OPTIONS = [60, 90, 120, 150, 180, 240, 300];
const LOG_GUARD_MS = 500;

function SessionTitle({
	name,
	startTime,
	logged,
	online,
	wrap = false,
}: {
	name: string;
	startTime: number;
	logged: number;
	online: boolean;
	/** In the body at large text there is room to wrap; the header has none. */
	wrap?: boolean;
}) {
	const copy = useI18n().t.strength.plan;
	const colors = useTokens();
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);
	const elapsed = Math.max(0, Math.floor((now - startTime) / 1000));
	return (
		<View
			style={wrap ? undefined : styles.title}
			accessibilityRole="header"
			accessible
		>
			<AppText variant="navTitle" numberOfLines={wrap ? undefined : 1}>
				{name}
			</AppText>
			<AppText
				variant="caption"
				numberOfLines={wrap ? undefined : 1}
				style={{ color: online ? colors.textMuted : colors.warn }}
			>
				{online
					? fmt(copy.headerProgress, {
							time: formatClock(elapsed),
							count: logged,
						})
					: copy.noConnection}
			</AppText>
		</View>
	);
}

export function StrengthSessionScreen() {
	const { id } = useLocalSearchParams<{ id?: Id<"workoutSessions"> }>();
	const active = useQuery(api.workoutSessions.getActive, id ? "skip" : {});
	const sessionId = id ?? active?._id;
	const workspace = useSessionWorkspace(sessionId);
	useSessionSync(workspace);
	const actions = useSessionActions(workspace);
	const {
		session,
		plan,
		online,
		writable,
		own,
		key,
		catalog,
		getFacts,
		nameOf,
		data,
	} = workspace;
	const { locale, t } = useI18n();
	const legacy = t.strength;
	const copy = legacy.plan;
	const router = useRouter();
	const colors = useTokens();
	const insets = useSafeAreaInsets();
	const large = useWindowDimensions().fontScale >= 1.35;
	const toast = useToast();
	const rest = useRestTimer();
	const choose = useChoice();
	const store = useSetDrafts();
	const [picker, setPicker] = useState<PickerRequest | null>(null);
	const [recapOpen, setRecapOpen] = useState(false);
	const [finishing, setFinishing] = useState(false);
	const [dockHeight, setDockHeight] = useState(0);
	const lastLog = useRef(0);
	const push = router.push;
	const openEditor = useCallback(
		(rowId: string) => {
			if (!sessionId) return;
			push({ pathname: "/set-editor", params: { sessionId, rowId } });
		},
		[push, sessionId],
	);
	const openProfile = useCallback(
		(exerciseId: string, rowId?: string) => {
			if (!sessionId) return;
			push({
				pathname: "/set-editor/strength-profile",
				params: { sessionId, exerciseId, ...(rowId ? { rowId } : {}) },
			});
		},
		[push, sessionId],
	);
	const openManual = useCallback(
		(exerciseId: string) => {
			if (!sessionId || actions.blocked()) return;
			push({ pathname: "/session-manual", params: { sessionId, exerciseId } });
		},
		[actions, push, sessionId],
	);
	const openGroup = useCallback(
		(groupId: string) => {
			if (!sessionId) return;
			push({ pathname: "/session-group", params: { sessionId, groupId } });
		},
		[push, sessionId],
	);
	const confirmDelete = useCallback(
		(rowId: string) => {
			const row = findRow(actions.plan(), rowId);
			if (!row) return;
			if (!row.setId) {
				void actions.deleteRow(rowId);
				return;
			}
			void choose({
				title: copy.editor.deleteTitle,
				message: copy.editor.deleteLoggedMessage,
				confirm: { label: copy.rowDelete, destructive: true },
				cancel: copy.keepTraining,
			}).then((yes) => {
				if (yes) void actions.deleteRow(rowId);
			});
		},
		[actions, choose, copy],
	);
	const toggleRow = useCallback(
		(rowId: string) => {
			const row = findRow(actions.plan(), rowId);
			if (!row || Date.now() - lastLog.current < LOG_GUARD_MS) return;
			if (row.done) void actions.unlog(rowId);
			else {
				lastLog.current = Date.now();
				actions.logRow(rowId, openEditor);
			}
		},
		[actions, openEditor],
	);
	const context = useMemo<SessionScreenValue | null>(
		() =>
			plan
				? {
						workspace,
						actions,
						plan,
						openEditor,
						openProfile,
						openManual,
						openGroup,
						openPicker: setPicker,
						confirmDelete,
						toggleRow,
					}
				: null,
		[
			actions,
			confirmDelete,
			openEditor,
			openGroup,
			openManual,
			openProfile,
			plan,
			toggleRow,
			workspace,
		],
	);
	const minimise = useCallback(() => {
		if (router.canGoBack()) router.back();
		else router.replace("/train");
	}, [router]);
	const leave = useCallback(() => {
		if (router.canDismiss()) router.dismissAll();
		router.replace("/train");
	}, [router]);
	const wods = workspace.wods?.length ?? 0;
	const logged = plan ? loggedCount(plan) : 0;
	const open = plan ? openCount(plan) : 0;
	const allDone = logged > 0 && open === 0;
	const name = session?.name ?? legacy.freeSession;
	async function finish() {
		if (!plan || actions.blocked()) return;
		if (actions.refusePending(allRows(plan))) return;
		if (logged === 0 && wods === 0) {
			const yes = await choose({
				title: copy.finish.emptyTitle,
				message: copy.finish.emptyMessage,
				confirm: { label: copy.finish.emptyConfirm, destructive: true },
				cancel: copy.keepTraining,
			});
			if (yes && (await actions.cancelSession(false))) {
				cancelClockAlerts(plan);
				workspaceStore.clear(key);
				rest.stop();
				leave();
			}
			return;
		}
		const edits = unsavedEdits(plan, workspace.drafts);
		if (open > 0 || edits > 0) {
			const yes = await choose({
				title: copy.finish.title,
				message: [
					open > 0 && plural(locale, open, copy.finish.open),
					edits > 0 && plural(locale, edits, copy.finish.unsavedEdits),
					plural(locale, logged, copy.finish.loggedCounts),
				]
					.filter(Boolean)
					.join(" "),
				confirm: { label: plural(locale, logged, copy.finish.confirmOpen) },
				cancel: copy.keepTraining,
			});
			if (!yes) return;
		}
		setRecapOpen(true);
	}
	async function confirmRecap() {
		// A send can fail or come back unresolved while the recap is open.
		if (actions.refusePending(allRows(actions.plan()))) {
			setRecapOpen(false);
			return;
		}
		setFinishing(true);
		const done = await actions.finishSession();
		setFinishing(false);
		if (!done) return;
		if (plan) cancelClockAlerts(plan);
		workspaceStore.clear(key);
		rest.stop();
		haptics.sessionSuccess();
		toast.success(fmt(copy.finish.saved, { name }));
		leave();
	}
	async function cancelWorkout() {
		if (actions.blocked()) return;
		if (actions.refuseUnresolved(allRows(actions.plan()))) return;
		const yes = await choose({
			title: copy.finish.cancelTitle,
			message: copy.finish.cancelMessage,
			confirm: { label: copy.cancelSession, destructive: true },
			cancel: copy.keepTraining,
		});
		if (yes && (await actions.cancelSession(logged > 0))) {
			if (plan) cancelClockAlerts(plan);
			workspaceStore.clear(key);
			rest.stop();
			leave();
		}
	}
	const restDefault = plan?.restDefault ?? rest.defaultSeconds;
	const setRestDefault = (seconds: number) => {
		rest.setDefault(seconds);
		workspaceStore.update(key, (current) => ({
			...current,
			restDefault: seconds,
		}));
	};
	useEffect(() => {
		if (session && own && session.status !== "active" && plan) {
			workspaceStore.clear(key);
			try {
				store.clearSession(session._id);
			} catch {
				// A leftover local draft for an ended session is harmless.
			}
		}
	}, [key, own, plan, session, store]);
	const startTime = session?.startTime;
	const headerTitle = useCallback(
		() =>
			// A null title falls back to the plain name; these two carry their own.
			recapOpen || large || startTime === undefined ? (
				<View />
			) : (
				<SessionTitle
					name={name}
					startTime={startTime}
					logged={logged}
					online={online}
				/>
			),
		[large, logged, name, online, recapOpen, startTime],
	);
	const menuGroups = [
		{
			options: [
				{ id: "add", label: copy.addExercise, symbol: "plus" as const },
			],
		},
		{
			title: fmt(copy.defaultRest, { time: formatClock(restDefault) }),
			options: REST_OPTIONS.map((seconds) => ({
				id: `rest:${seconds}`,
				label: formatClock(seconds),
				selected: seconds === restDefault,
			})),
		},
		{
			options: [
				{
					id: "cancel",
					label: copy.cancelSession,
					destructive: true,
					disabled: !writable,
				},
			],
		},
	];
	const onMenu = (option: string) => {
		if (option === "add") setPicker({ mode: "add" });
		else if (option === "cancel") void cancelWorkout();
		else if (option.startsWith("rest:"))
			setRestDefault(Number(option.slice("rest:".length)));
	};
	const showChrome = Boolean(
		session && own && plan && !recapOpen && workspace.active,
	);
	// The latest handlers, so these options keep one identity between renders.
	const handlers = useRef({ finish, onMenu, menuGroups });
	handlers.current = { finish, onMenu, menuGroups };
	const screenOptions = useMemo(
		() => ({
			// Never toggle headerShown: on a modal that remounts the screen and
			// loses the open recap.
			title: name,
			headerTitle,
			headerTitleAlign: "left" as const,
			headerTransparent: Platform.OS === "ios",
			// Rows scroll under this small title; it has to stay readable.
			...(Platform.OS === "ios"
				? {
						headerBlurEffect: recapOpen
							? ("none" as const)
							: ("systemChromeMaterial" as const),
					}
				: {}),
			headerBackVisible: false,
			headerShadowVisible: false,
			...(Platform.OS === "android" && showChrome
				? {
						headerLeft: () => (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={copy.minimise}
								onPress={minimise}
								style={styles.androidHeaderButton}
							>
								<AppText variant="control">˅</AppText>
							</Pressable>
						),
						headerRight: () => (
							<View style={styles.androidHeaderRight}>
								<SelectionMenu
									trigger="ellipsis"
									label={copy.sessionMenu}
									accessibilityLabel={copy.sessionMenu}
									groups={handlers.current.menuGroups}
									onSelect={(option) => handlers.current.onMenu(option)}
								/>
								<Pressable
									accessibilityRole="button"
									onPress={() => void handlers.current.finish()}
									style={styles.androidHeaderButton}
								>
									<AppText variant="control" style={{ color: colors.accent }}>
										{copy.done}
									</AppText>
								</Pressable>
							</View>
						),
					}
				: {}),
		}),
		[colors.accent, copy, headerTitle, minimise, name, recapOpen, showChrome],
	);
	return (
		<>
			<Stack.Screen options={screenOptions} />
			{Platform.OS === "ios" && !recapOpen ? (
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button
						icon="chevron.down"
						accessibilityLabel={copy.minimise}
						onPress={minimise}
					/>
				</Stack.Toolbar>
			) : null}
			{Platform.OS === "ios" && showChrome ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Menu
						icon="ellipsis"
						accessibilityLabel={copy.sessionMenu}
					>
						<Stack.Toolbar.MenuAction
							icon="plus"
							onPress={() => setPicker({ mode: "add" })}
						>
							{copy.addExercise}
						</Stack.Toolbar.MenuAction>
						<Stack.Toolbar.Menu
							title={fmt(copy.defaultRest, { time: formatClock(restDefault) })}
							icon="timer"
						>
							{REST_OPTIONS.map((seconds) => (
								<Stack.Toolbar.MenuAction
									key={seconds}
									isOn={seconds === restDefault}
									onPress={() => setRestDefault(seconds)}
								>
									{formatClock(seconds)}
								</Stack.Toolbar.MenuAction>
							))}
						</Stack.Toolbar.Menu>
						<Stack.Toolbar.MenuAction
							destructive
							icon="xmark"
							disabled={!writable}
							onPress={() => void cancelWorkout()}
						>
							{copy.cancelSession}
						</Stack.Toolbar.MenuAction>
					</Stack.Toolbar.Menu>
					<Stack.Toolbar.Spacer width={8} />
					<Stack.Toolbar.Button
						variant={allDone ? "prominent" : "plain"}
						tintColor={allDone ? colors.accentFill : undefined}
						onPress={() => void finish()}
					>
						{copy.done}
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
			<View style={[styles.screen, { backgroundColor: colors.bg }]}>
				{!sessionId || !session || !own || !plan ? (
					<View style={[styles.message, { paddingTop: insets.top + 64 }]}>
						<AppText>
							{!sessionId
								? active === undefined
									? legacy.checking
									: legacy.noActive
								: data.session === undefined || (session && own)
									? legacy.checking
									: legacy.unavailable}
						</AppText>
					</View>
				) : !workspace.active ? (
					<View style={[styles.message, { paddingTop: insets.top + 64 }]}>
						<AppText>{legacy.ended}</AppText>
					</View>
				) : recapOpen ? (
					<SessionRecap
						name={name}
						elapsedSeconds={Math.floor((Date.now() - session.startTime) / 1000)}
						recap={recapOf(closeOpenClocks(plan), getFacts)}
						getFacts={getFacts}
						nameOf={nameOf}
						busy={finishing}
						onConfirm={() => void confirmRecap()}
						onBack={() => setRecapOpen(false)}
					/>
				) : context ? (
					<SessionScreenContext.Provider value={context}>
						<ScrollView
							contentInsetAdjustmentBehavior="automatic"
							keyboardShouldPersistTaps="handled"
							contentContainerStyle={[
								styles.content,
								{ paddingBottom: dockHeight + spacing.lg },
							]}
						>
							{large ? (
								<SessionTitle
									name={name}
									startTime={session.startTime}
									logged={logged}
									online={online}
									wrap
								/>
							) : null}
							{workspace.storageError ? (
								<AppText variant="footnote" accessibilityRole="alert">
									{copy.storageError}
								</AppText>
							) : null}
							{data.error ? (
								<AppText accessibilityRole="alert">
									{legacy.unavailableHint}
								</AppText>
							) : null}
							{plan.order.length === 0 && workspace.sets && wods === 0 ? (
								<View style={styles.empty}>
									<AppText variant="heading">{copy.emptyTitle}</AppText>
									<AppText
										variant="secondary"
										style={{ color: colors.textMuted }}
									>
										{copy.emptyBody}
									</AppText>
								</View>
							) : null}
							{plan.order.map((entry) => {
								if (entry.kind === "exercise")
									return (
										<SessionExerciseBlock
											key={entry.exerciseId}
											exerciseId={entry.exerciseId}
										/>
									);
								const group = plan.groups[entry.groupId];
								return group ? (
									<SessionGroupBlock key={group.id} group={group} />
								) : null;
							})}
							{plan.order.length > 0 ? (
								<Pressable
									accessibilityRole="button"
									disabled={!online}
									onPress={() => setPicker({ mode: "add" })}
									style={[styles.addExercise, !online && styles.dimmed]}
									testID="session-add-exercise"
								>
									<AppText variant="control" style={{ color: colors.accent }}>
										{copy.addExercise}
									</AppText>
								</Pressable>
							) : null}
							<HostedSessionPanel
								sessionId={sessionId}
								busy={false}
								writable={writable}
								write={(action) => store.run(sessionId, action)}
							/>
						</ScrollView>
						{plan.order.length === 0 && wods === 0 ? (
							<View
								style={[
									styles.emptyFooter,
									{ paddingBottom: insets.bottom + spacing.sm },
								]}
							>
								<Pressable
									accessibilityRole="button"
									disabled={!online}
									onPress={() => setPicker({ mode: "add" })}
									style={[
										styles.emptyButton,
										{ backgroundColor: colors.accentFill },
										!online && styles.dimmed,
									]}
									testID="session-add-exercise"
								>
									<AppText
										variant="control"
										style={{ color: colors.onAccent, fontWeight: "700" }}
									>
										{copy.addExercise}
									</AppText>
								</Pressable>
							</View>
						) : (
							<SessionDock onHeight={setDockHeight} />
						)}
						{picker ? (
							<SessionExercisePicker
								title={
									picker.mode === "swap"
										? copy.picker.titleSwap
										: picker.mode === "group"
											? copy.picker.titleGroup
											: copy.picker.title
								}
								exercises={catalog}
								inSession={sessionExercises(plan)}
								onClose={() => setPicker(null)}
								onPick={(exercise) => {
									const request = picker;
									setPicker(null);
									if (request.mode === "swap")
										void actions.swap(
											request.from,
											exercise._id,
											exercise.name,
										);
									else if (request.mode === "group")
										void actions.addExerciseToGroup(
											request.groupId,
											exercise._id,
											exercise.name,
										);
									else
										void actions.addExercise(
											exercise._id,
											openEditor,
											exercise.name,
										);
								}}
								onCreate={(exerciseName, bodyweight) => {
									const request = picker;
									setPicker(null);
									void actions.createAndAdd(
										exerciseName,
										bodyweight,
										request.mode === "swap" ? request.from : undefined,
										request.mode === "group" ? request.groupId : undefined,
										openEditor,
									);
								}}
							/>
						) : null}
					</SessionScreenContext.Provider>
				) : null}
			</View>
		</>
	);
}
const styles = StyleSheet.create({
	screen: { flex: 1 },
	title: { minWidth: 0, maxWidth: 200 },
	message: { padding: spacing.md },
	content: { padding: spacing.md, gap: spacing.lg },
	empty: { gap: spacing.xs, paddingTop: spacing.xl, alignItems: "center" },
	emptyFooter: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
	emptyButton: {
		minHeight: 56,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.pill,
	},
	addExercise: {
		minHeight: 48,
		alignItems: "center",
		justifyContent: "center",
	},
	dimmed: { opacity: 0.5 },
	androidHeaderButton: {
		minWidth: 44,
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	androidHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
});
