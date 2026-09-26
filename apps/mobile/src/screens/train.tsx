import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api } from "../convex/api";
import { useRoutines, useShellData } from "../data/session-data";
import { useI18n } from "../i18n";
import { type Tokens, useThemedStyles, useTokens } from "../theme";
import { GhostButton } from "../ui/button";
import { Chip, Eyebrow, SportIcon } from "../ui/coach";
import { convexErrorMessage, useConfirm } from "../ui/confirm-dialog";
import { InsetList, InsetRow } from "../ui/inset-list";
import { SwipeableRow } from "../ui/swipeable-row";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { activityCopy } from "./activity-copy";

const FILTERS = ["All", "Strength", "Running", "Cycling", "WOD"] as const;

type Routines = NonNullable<ReturnType<typeof useRoutines>>;
type Routine = Routines[number];

export function TrainScreen() {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const router = useRouter();
	const { locale } = useI18n();
	const copy = activityCopy(locale);
	const toast = useToast();
	const confirm = useConfirm();
	const routines = useRoutines();
	const { exercises } = useShellData();
	const removeRoutine = useMutation(api.routines.remove);
	const startFromRoutine = useMutation(api.routines.startSession);

	const [busy, setBusy] = useState<string | null>(null);

	const start = async (routine: Routine) => {
		if (busy) return;
		setBusy(routine._id);
		try {
			const id = await startFromRoutine({ routineId: routine._id });
			router.push({ pathname: "/session", params: { id } });
		} catch (error) {
			const message = convexErrorMessage(error, "Could not start the session.");
			// Already training? Take them there rather than scolding them.
			if (message.toLowerCase().includes("already active")) {
				router.push("/session");
			} else {
				toast.error(message);
			}
		} finally {
			setBusy(null);
		}
	};

	const remove = async (routine: Routine) => {
		const confirmed = await confirm({
			title: `Delete ${routine.name}?`,
			message: "Sessions you already logged from it are kept.",
			confirmLabel: "Delete routine",
			destructive: true,
		});
		if (!confirmed) return;
		try {
			await removeRoutine({ id: routine._id });
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not delete the routine."));
		}
	};

	return (
		<ScrollView
			style={styles.root}
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				<View style={styles.filterRow}>
					{FILTERS.map((f) => (
						<Pressable
							key={f}
							accessibilityRole="button"
							style={{
								minHeight: 48,
								justifyContent: "center",
								paddingHorizontal: 2,
							}}
							onPress={() =>
								f === "WOD"
									? router.push("/wods")
									: router.push({
											pathname: "/activity-history",
											params: f === "All" ? {} : { sport: f.toLowerCase() },
										})
							}
						>
							<Chip
								label={
									f === "All"
										? copy.all
										: f === "Strength"
											? copy.strength
											: f === "Running"
												? copy.running
												: f === "Cycling"
													? copy.cycling
													: f
								}
							/>
						</Pressable>
					))}
				</View>
			</ScrollView>

			<Pressable
				onPress={() => router.push("/start-activity")}
				accessibilityRole="button"
				style={styles.startBtn}
			>
				<AppText style={styles.startBtnText}>{copy.startActivity}</AppText>
			</Pressable>

			<GhostButton
				label={copy.history}
				onPress={() => router.push("/activity-history")}
			/>
			<View style={styles.between}>
				<Eyebrow>Routines</Eyebrow>
				<Pressable
					onPress={() => router.push("/routine-editor")}
					hitSlop={12}
					accessibilityRole="button"
					accessibilityLabel="New routine"
				>
					<AppText style={styles.action}>New</AppText>
				</Pressable>
			</View>

			{routines === undefined ? (
				<AppText style={styles.muted}>Loading…</AppText>
			) : routines.length === 0 ? (
				<View style={styles.empty}>
					<AppText variant="heading" style={{ color: colors.textMuted }}>
						No routines yet
					</AppText>
					<AppText variant="caption" style={styles.centered}>
						A routine is a template — the exercises, sets and reps you repeat.
					</AppText>
				</View>
			) : (
				<View style={styles.list}>
					{routines.map((r) => (
						<SwipeableRow
							key={r._id}
							menuTitle={r.name}
							closeMenuLabel="Close"
							actions={[
								{
									key: "edit",
									label: "Edit routine",
									onPress: () =>
										router.push({
											pathname: "/routine-editor",
											params: { id: r._id },
										}),
								},
								{
									key: "delete",
									label: "Delete routine",
									destructive: true,
									onPress: () => void remove(r),
								},
							]}
						>
							{(accessibility) => (
								<View style={styles.card}>
									<Pressable
										style={styles.row}
										onPress={() =>
											router.push({
												pathname: "/routine-editor",
												params: { id: r._id },
											})
										}
										{...accessibility}
										accessibilityRole="button"
										accessibilityLabel={r.name}
									>
										<SportIcon sport="strength" size={40} />
										<View style={styles.flex}>
											<AppText style={styles.rowTitle}>{r.name}</AppText>
											<AppText style={styles.rowSub}>
												{r.exercises.length} exercise
												{r.exercises.length === 1 ? "" : "s"}
											</AppText>
										</View>
									</Pressable>

									{r.exercises.length > 0 ? (
										<View style={styles.chipWrap}>
											{r.exercises.slice(0, 4).map((e) => (
												<Chip
													key={e.exerciseId}
													label={`${e.exerciseName} ${e.defaultSets}×${e.defaultReps}`}
												/>
											))}
											{r.exercises.length > 4 ? (
												<Chip label={`+${r.exercises.length - 4} more`} />
											) : null}
										</View>
									) : null}

									<View style={styles.actions}>
										<Pressable
											onPress={() => void start(r)}
											disabled={busy !== null}
											style={[
												styles.primaryBtn,
												busy !== null && styles.dimmed,
											]}
										>
											<AppText style={styles.primaryBtnText}>
												{busy === r._id ? "Starting…" : "Start"}
											</AppText>
										</Pressable>
										<Pressable
											onPress={() =>
												router.push({
													pathname: "/routine-editor",
													params: { id: r._id },
												})
											}
											style={styles.ghostBtn}
										>
											<AppText style={styles.ghostBtnText}>Edit</AppText>
										</Pressable>
										<Pressable
											onPress={() => void remove(r)}
											style={styles.ghostBtn}
											accessibilityRole="button"
											accessibilityLabel={`Delete ${r.name}`}
										>
											<AppText style={styles.deleteText}>Delete</AppText>
										</Pressable>
									</View>
								</View>
							)}
						</SwipeableRow>
					))}
				</View>
			)}

			<InsetList header="Library">
				<InsetRow
					leading={{ sport: "strength" }}
					title="Exercises"
					secondary={
						exercises === undefined ? "…" : `${exercises.length} exercises`
					}
					chevron
					onPress={() => router.push("/exercises")}
				/>
				<InsetRow
					leading={{ sport: "wod" }}
					title="WODs"
					secondary="Benchmarks and your own, with scores"
					chevron
					onPress={() => router.push("/wods")}
				/>
				<InsetRow
					leading={{ sport: "wod" }}
					title="Hosted workouts"
					secondary="Join with a code, or run one"
					chevron
					onPress={() => router.push("/hosted")}
				/>
			</InsetList>
		</ScrollView>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: { padding: 20, paddingTop: 12, gap: 14, paddingBottom: 24 },
		filterRow: { flexDirection: "row", gap: 7 },
		between: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		action: { fontSize: 13, fontWeight: "800", color: colors.accent },
		muted: { fontSize: 13, color: colors.textMuted },
		centered: { textAlign: "center" },
		empty: {
			alignItems: "center",
			gap: 4,
			paddingVertical: 24,
			paddingHorizontal: 16,
			backgroundColor: colors.surface,
			borderRadius: 14,
		},
		list: { gap: 8 },
		flex: { flex: 1, gap: 2 },
		card: {
			gap: 10,
			backgroundColor: colors.surface,
			borderRadius: 14,
			padding: 12,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			backgroundColor: colors.surface,
			borderRadius: 14,
			padding: 12,
		},
		rowTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
		rowSub: { fontSize: 11, color: colors.textMuted },
		chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
		actions: { flexDirection: "row", gap: 8 },
		primaryBtn: {
			flex: 1,
			minHeight: 44,
			borderRadius: 9999,
			backgroundColor: colors.accentFill,
			alignItems: "center",
			justifyContent: "center",
		},
		primaryBtnText: { fontSize: 13, fontWeight: "800", color: colors.onAccent },
		ghostBtn: {
			minHeight: 44,
			paddingHorizontal: 16,
			borderRadius: 9999,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			alignItems: "center",
			justifyContent: "center",
		},
		ghostBtnText: { fontSize: 13, fontWeight: "700", color: colors.text },
		deleteText: { fontSize: 13, fontWeight: "700", color: colors.danger },
		dimmed: { opacity: 0.5 },
		startBtn: {
			height: 48,
			borderRadius: 9999,
			backgroundColor: colors.accentFill,
			alignItems: "center",
			justifyContent: "center",
		},
		startBtnText: { fontSize: 15, fontWeight: "800", color: colors.onAccent },
	});
