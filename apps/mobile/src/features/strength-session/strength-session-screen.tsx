import { convertLoad } from "@workouts/core";
import type { ExerciseId } from "@workouts/core/exercises";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { api, type Id } from "../../convex/api";
import { useExercises } from "../../data/exercises";
import { useI18n } from "../../i18n";
import { AddExercisePicker } from "../../screens/add-exercise-picker";
import { HostedSessionPanel } from "../../screens/hosted-session-panel";
import { radius, spacing, useTokens } from "../../theme";
import { PrimaryButton } from "../../ui/button";
import { convexErrorMessage, useConfirm } from "../../ui/confirm-dialog";
import { FormScreen, GroupedSurface } from "../../ui/form";
import { RestTimerBar, useRestTimer } from "../../ui/rest-timer";
import { SelectionMenu } from "../../ui/selection-menu";
import { AppText } from "../../ui/text";
import { useToast } from "../../ui/toast";
import { SessionSetTable } from "./components/session-set-table";
import { useSetDrafts } from "./data/set-drafts";
import { useStrengthSession } from "./data/use-strength-session";

export function StrengthSessionScreen() {
	const { id } = useLocalSearchParams<{ id?: Id<"workoutSessions"> }>();
	const active = useQuery(api.workoutSessions.getActive, id ? "skip" : {});
	const sessionId = id ?? active?._id;
	const data = useStrengthSession(sessionId);
	const store = useSetDrafts();
	const router = useRouter();
	const colors = useTokens();
	const {
		locale,
		t: { strength: copy },
	} = useI18n();
	const toast = useToast();
	const confirm = useConfirm();
	const rest = useRestTimer();
	const catalog = useExercises();
	const addExercise = useMutation(api.workoutSessions.addExercise);
	const finish = useMutation(api.workoutSessions.finish);
	const cancel = useMutation(api.workoutSessions.cancel);
	const [picking, setPicking] = useState(false);
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);
	const session = data.session instanceof Error ? undefined : data.session;
	const sets = Array.isArray(data.sets) ? data.sets : undefined;
	const wods = Array.isArray(data.wods) ? data.wods : undefined;
	const busy = Boolean(sessionId && store.busy.has(sessionId));
	const own = session?.userId === store.subject;
	const isActive = own && session?.status === "active";
	const writable = Boolean(
		isActive && data.verified && sets && wods && data.online,
	);
	const localDrafts = store.drafts.filter(
		(draft) => draft.sessionId === sessionId,
	);
	const order = [
		...new Set([
			...(session?.exercises?.map((exercise) => exercise.exerciseId) ?? []),
			...(sets?.map((set) => set.exerciseId) ?? []),
		]),
	];
	const totalVolume =
		sets
			?.filter((set) => set.setType === "working")
			.reduce(
				(sum, set) => sum + convertLoad(set.weight, set.unit, "kg") * set.reps,
				0,
			) ?? 0;
	const elapsed = session
		? Math.max(
				0,
				Math.floor(((session.endTime ?? now) - session.startTime) / 1000),
			)
		: 0;
	const format = (value: number) =>
		value.toLocaleString(locale, { maximumFractionDigits: 1 });
	useEffect(() => {
		if (
			session &&
			own &&
			session.status !== "active" &&
			localDrafts.length &&
			!busy &&
			!store.storageError
		) {
			try {
				store.clearSession(session._id);
			} catch {
				toast.error(copy.storageError);
			}
		}
	}, [session, own, localDrafts.length, busy, store, toast, copy.storageError]);
	async function openEditor(exerciseId: ExerciseId, setId?: Id<"sets">) {
		if (!sessionId || !own || busy) return;
		if (!setId && !isActive) return;
		try {
			// Legacy active sessions receive a reference snapshot when the exercise is first opened.
			if (
				isActive &&
				data.online &&
				!session?.exercises?.find((item) => item.exerciseId === exerciseId)
					?.references
			) {
				if (
					!(await store.run(sessionId, () =>
						addExercise({ sessionId, exerciseId }),
					))
				)
					return;
			}
			router.push({
				pathname: "/set-editor",
				params: { sessionId, exerciseId, ...(setId ? { setId } : {}) },
			});
		} catch (error) {
			toast.error(convexErrorMessage(error, copy.saveError));
		}
	}
	async function end(cancelled: boolean) {
		if (!sessionId || !writable || busy) return;
		const empty = sets?.length === 0 && wods?.length === 0;
		const unfinished =
			localDrafts.length > 0 ||
			session?.exercises?.some(
				(exercise) =>
					(sets?.filter((set) => set.exerciseId === exercise.exerciseId)
						.length ?? 0) < exercise.plannedSets.length,
			);
		if (
			!(await confirm({
				title: cancelled
					? copy.cancelTitle
					: empty
						? copy.emptyTitle
						: copy.finishTitle,
				message: cancelled
					? copy.cancelMessage
					: empty
						? copy.emptyMessage
						: unfinished
							? copy.unfinished
							: copy.finishedMessage,
				confirmLabel: cancelled
					? copy.cancelSession
					: empty
						? copy.discard
						: copy.finish,
				cancelLabel: copy.keepGoing,
				destructive: cancelled || empty,
			}))
		)
			return;
		try {
			const done = await store.run(sessionId, async () => {
				if (cancelled || empty) await cancel({ id: sessionId });
				else await finish({ id: sessionId, discardUnfinished: true });
				store.clearSession(sessionId);
				rest.stop();
			});
			if (done)
				router.replace(
					cancelled || empty
						? "/train"
						: { pathname: "/summary", params: { id: sessionId } },
				);
		} catch (error) {
			toast.error(convexErrorMessage(error, copy.saveError));
		}
	}
	const menu = [
		{
			id: "cancel",
			label: copy.cancelSession,
			destructive: true,
			disabled: !writable || busy,
		},
	];
	return (
		<>
			<Stack.Screen
				options={{
					title: session?.name ?? copy.freeSession,
					...(Platform.OS === "android"
						? {
								headerRight: () => (
									<SelectionMenu
										trigger="ellipsis"
										label={copy.session}
										accessibilityLabel={copy.session}
										groups={[{ options: menu }]}
										onSelect={() => void end(true)}
									/>
								),
							}
						: {}),
				}}
			/>
			{Platform.OS === "ios" && (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={copy.session}>
						<Stack.Toolbar.MenuAction
							destructive
							disabled={!writable || busy}
							onPress={() => void end(true)}
						>
							{copy.cancelSession}
						</Stack.Toolbar.MenuAction>
					</Stack.Toolbar.Menu>
					<Stack.Toolbar.Button
						disabled={!writable || busy}
						onPress={() => void end(false)}
					>
						{copy.finish}
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			)}
			<View style={{ flex: 1, backgroundColor: colors.bg }}>
				<FormScreen>
					{!sessionId ? (
						<AppText>
							{active === undefined ? copy.checking : copy.noActive}
						</AppText>
					) : !session || !own ? (
						<AppText>
							{data.session === undefined ? copy.checking : copy.unavailable}
						</AppText>
					) : (
						<>
							<View style={styles.totals}>
								<View>
									<AppText variant="footnote">{copy.elapsed}</AppText>
									<AppText variant="heading">
										{Math.floor(elapsed / 60)}:
										{String(elapsed % 60).padStart(2, "0")}
									</AppText>
								</View>
								<View>
									<AppText variant="footnote">{copy.logged}</AppText>
									<AppText variant="heading">
										{sets?.length ?? "—"}{" "}
										{sets?.length === 1 ? copy.singleSet : copy.sets}
									</AppText>
								</View>
								<View>
									<AppText variant="footnote">{copy.volume}</AppText>
									<AppText variant="heading">
										{sets ? `${format(totalVolume)} kg` : "—"}
									</AppText>
								</View>
							</View>
							{!data.online && (
								<AppText variant="footnote">{copy.offline}</AppText>
							)}
							{!isActive && <AppText>{copy.ended}</AppText>}
							{data.error && (
								<AppText accessibilityRole="alert">
									{copy.unavailableHint}
								</AppText>
							)}
							{order.length === 0 && sets && (
								<GroupedSurface>
									<AppText variant="heading">{copy.empty}</AppText>
									<AppText>{copy.emptyHint}</AppText>
								</GroupedSurface>
							)}
							{order.map((exerciseId) => {
								const exercise = catalog?.find(
									(item) => item._id === exerciseId,
								);
								const exerciseSets =
									sets?.filter((set) => set.exerciseId === exerciseId) ?? [];
								const planned =
									session.exercises?.find(
										(item) => item.exerciseId === exerciseId,
									)?.plannedSets ?? [];
								const draft = store.get(sessionId, exerciseId);
								const name = exercise?.name ?? copy.exercises;
								return (
									<View key={exerciseId} style={styles.exercise}>
										<AppText variant="heading">{name}</AppText>
										<AppText variant="footnote">
											{exerciseSets.length}{" "}
											{copy.logged.toLocaleLowerCase(locale)}
											{planned.length
												? ` · ${planned.length} ${copy.planned.toLocaleLowerCase(locale)}`
												: ""}
										</AppText>
										<SessionSetTable
											sessionId={sessionId}
											exerciseId={exerciseId}
											name={name}
											sets={exerciseSets}
											planned={planned}
											busy={busy}
											active={Boolean(isActive)}
											onOpen={(setId) => void openEditor(exerciseId, setId)}
										/>
										{isActive && (
											<Pressable
												accessibilityRole="button"
												accessibilityLabel={`${copy.addSet} ${name}`}
												disabled={busy || store.storageError}
												onPress={() => void openEditor(exerciseId)}
												style={[
													styles.add,
													{ backgroundColor: colors.surface },
												]}
											>
												<AppText style={{ color: colors.accent }}>
													{draft
														? `${copy.localDraft}: ${draft.fields.weight} ${draft.fields.unit} × ${draft.fields.reps}`
														: `+ ${copy.addSet}`}
												</AppText>
											</Pressable>
										)}
									</View>
								);
							})}
							{isActive && (
								<PrimaryButton
									label={copy.addExercise}
									disabled={!data.online || busy}
									onPress={() => setPicking(true)}
								/>
							)}
							<HostedSessionPanel
								sessionId={sessionId}
								busy={busy}
								writable={writable}
								write={(action) => store.run(sessionId, action)}
							/>
							{Platform.OS !== "ios" && isActive && (
								<PrimaryButton
									label={copy.finish}
									disabled={!writable || busy}
									onPress={() => void end(false)}
								/>
							)}
						</>
					)}
				</FormScreen>
				<RestTimerBar />
			</View>
			{picking && (
				<AddExercisePicker
					visible
					exercises={catalog}
					onClose={() => setPicking(false)}
					onSelect={(exerciseId) => {
						if (!sessionId || busy || !writable) return;
						void store
							.run(sessionId, async () => {
								await addExercise({ sessionId, exerciseId });
								setPicking(false);
							})
							.catch((error) =>
								toast.error(convexErrorMessage(error, copy.saveError)),
							);
					}}
				/>
			)}
		</>
	);
}
const styles = StyleSheet.create({
	totals: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
		gap: spacing.md,
	},
	exercise: { gap: spacing.sm },
	add: {
		minHeight: 48,
		alignItems: "center",
		justifyContent: "center",
		padding: spacing.sm,
		borderRadius: radius.contentCard,
	},
});
