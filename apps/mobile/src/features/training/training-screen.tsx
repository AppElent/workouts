import { useMutation } from "convex/react";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { api } from "../../convex/api";
import { useExercises } from "../../data/exercises";
import { useI18n } from "../../i18n";
import { spacing, useTokens } from "../../theme";
import { PrimaryButton } from "../../ui/button";
import { convexErrorMessage, useConfirm } from "../../ui/confirm-dialog";
import { FormScreen } from "../../ui/form";
import { InsetList, InsetRow } from "../../ui/inset-list";
import { SelectionMenu } from "../../ui/selection-menu";
import type { RowAction } from "../../ui/swipeable-row";
import { AppText } from "../../ui/text";
import { useToast } from "../../ui/toast";
import { useStartStrengthSession } from "./use-start-strength-session";
import { type Routine, useTrainingData } from "./use-training-data";

export function TrainingScreen() {
	const colors = useTokens();
	const router = useRouter();
	const {
		t: { training: copy },
	} = useI18n();
	const data = useTrainingData();
	const { start, pending } = useStartStrengthSession(data);
	const exercises = useExercises();
	const removeRoutine = useMutation(api.routines.remove);
	const confirm = useConfirm();
	const toast = useToast();
	const deleting = useRef(false);
	const [removing, setRemoving] = useState(false);
	const busy = pending || removing;
	const edit = (routine: Routine) => {
		if (!busy)
			router.push({ pathname: "/routine-editor", params: { id: routine._id } });
	};
	async function play(routine: Routine) {
		if (deleting.current) return;
		const id = await start({ routineId: routine._id });
		if (id) router.push({ pathname: "/session", params: { id } });
	}
	async function remove(routine: Routine) {
		if (busy || deleting.current) return;
		if (!data.online) {
			toast.error(copy.onlineRequired);
			return;
		}
		deleting.current = true;
		setRemoving(true);
		try {
			if (
				!(await confirm({
					title: `${copy.deleteQuestion} ${routine.name}?`,
					message: copy.deleteMessage,
					confirmLabel: copy.delete,
					cancelLabel: copy.cancel,
					destructive: true,
				}))
			)
				return;
			await removeRoutine({ id: routine._id });
		} catch (error) {
			toast.error(convexErrorMessage(error, copy.deleteError));
		} finally {
			deleting.current = false;
			setRemoving(false);
		}
	}
	const history = [
		{ id: "all", label: copy.allActivity },
		{ id: "strength", label: copy.strength },
		{ id: "running", label: copy.running },
		{ id: "cycling", label: copy.cycling },
		{ id: "wod", label: copy.wod },
	];
	const openHistory = (sport: string) =>
		router.push({
			pathname: "/activity-history",
			params: sport === "all" ? {} : { sport },
		});
	return (
		<>
			{Platform.OS === "ios" ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={copy.history}>
						{history.map((item) => (
							<Stack.Toolbar.MenuAction
								key={item.id}
								onPress={() => openHistory(item.id)}
							>
								{item.label}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				</Stack.Toolbar>
			) : (
				<Stack.Screen
					options={{
						headerRight: () => (
							<SelectionMenu
								trigger="ellipsis"
								label={copy.history}
								accessibilityLabel={copy.history}
								groups={[{ options: history }]}
								onSelect={openHistory}
							/>
						),
					}}
				/>
			)}
			<FormScreen>
				<PrimaryButton
					label={copy.startActivity}
					onPress={() => router.push("/start-activity")}
					disabled={busy}
				/>
				<View style={styles.heading}>
					<AppText variant="heading">{copy.routines}</AppText>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={copy.newRoutine}
						disabled={busy}
						onPress={() => router.push("/routine-editor")}
						style={styles.textButton}
					>
						<AppText style={{ color: colors.accent }}>{copy.new}</AppText>
					</Pressable>
				</View>
				{!data.online && (
					<AppText variant="footnote">
						{data.routines === undefined ? copy.coldOffline : copy.offline}
					</AppText>
				)}
				{data.error && (
					<View style={styles.status}>
						<AppText>{copy.loadError}</AppText>
						<Pressable
							accessibilityRole="button"
							onPress={data.retry}
							style={styles.textButton}
						>
							<AppText style={{ color: colors.accent }}>{copy.retry}</AppText>
						</Pressable>
					</View>
				)}
				{data.routines === undefined && data.online && !data.error && (
					<AppText>{copy.loading}</AppText>
				)}
				{data.routines !== undefined && data.refreshing && data.online && (
					<AppText variant="footnote">{copy.refreshing}</AppText>
				)}
				{data.routines?.length === 0 && (
					<View style={styles.status}>
						<AppText variant="heading">{copy.empty}</AppText>
						<AppText variant="secondary">{copy.emptyHint}</AppText>
					</View>
				)}
				{Boolean(data.routines?.length) && (
					<InsetList compact>
						{data.routines?.map((routine) => {
							const actions: RowAction[] = [
								{
									key: "start",
									label: copy.startRoutine,
									systemImage: "play",
									swipe: false,
									onPress: () => void play(routine),
								},
								{
									key: "edit",
									label: copy.edit,
									systemImage: "pencil",
									onPress: () => edit(routine),
								},
								{
									key: "delete",
									label: copy.delete,
									systemImage: "trash",
									destructive: true,
									fullSwipe: false,
									onPress: () => void remove(routine),
								},
							];
							return (
								<InsetRow
									key={routine._id}
									title={routine.name}
									secondary={`${routine.exercises.length} ${routine.exercises.length === 1 ? copy.singleExercise : copy.exerciseCount} · ${routine.exercises.reduce((total, exercise) => total + exercise.defaultSets, 0)} ${copy.setCount}`}
									onPress={() => edit(routine)}
									actions={actions}
									trailing={
										<View style={styles.actions}>
											<Pressable
												accessibilityRole="button"
												accessibilityLabel={`${copy.startFor} ${routine.name}`}
												accessibilityState={{ disabled: busy }}
												disabled={busy}
												onPress={() => void play(routine)}
												style={styles.play}
											>
												<SymbolView
													name={{
														ios: "play.fill",
														android: "play_arrow",
														web: "play_arrow",
													}}
													size={18}
													tintColor={colors.accent}
												/>
											</Pressable>
											<SelectionMenu
												trigger="ellipsis"
												label={routine.name}
												accessibilityLabel={`${copy.actionsFor} ${routine.name}`}
												disabled={busy}
												groups={[
													{
														options: actions.map((action) => ({
															id: action.key,
															label: action.label,
															destructive: action.destructive,
														})),
													},
												]}
												onSelect={(key) =>
													actions
														.find((action) => action.key === key)
														?.onPress()
												}
											/>
										</View>
									}
								/>
							);
						})}
					</InsetList>
				)}
				<InsetList compact header={copy.library}>
					<InsetRow
						leading={{ sport: "strength" }}
						title={copy.exercises}
						secondary={
							exercises === undefined
								? undefined
								: `${exercises.length} ${copy.exerciseCount}`
						}
						chevron
						onPress={() => router.push("/exercises")}
					/>
					<InsetRow
						leading={{ sport: "wod" }}
						title={copy.wods}
						secondary={copy.wodHint}
						chevron
						onPress={() => router.push("/wods")}
					/>
					<InsetRow
						leading={{ sport: "wod" }}
						title={copy.hosted}
						secondary={copy.hostedHint}
						chevron
						onPress={() => router.push("/hosted")}
					/>
				</InsetList>
			</FormScreen>
		</>
	);
}
const styles = StyleSheet.create({
	heading: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	textButton: {
		minHeight: 48,
		justifyContent: "center",
		paddingHorizontal: spacing.sm,
	},
	status: { gap: spacing.sm, paddingVertical: spacing.md },
	actions: { flexDirection: "row", alignItems: "center" },
	play: {
		minHeight: 48,
		minWidth: 48,
		alignItems: "center",
		justifyContent: "center",
	},
});
