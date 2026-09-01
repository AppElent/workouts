/**
 * The strength session log. Laid out from `designs/shell/index.html#flows`
 * ("Strength session — set-and-rep table"), behaviour ported from the web's
 * `src/routes/log/$sessionId.tsx` + `src/components/session/ExerciseSection.tsx`.
 *
 * This screen never creates a session — `start-activity.tsx` does that and
 * pushes the id here. If you arrive without one (resuming from the chrome bar,
 * or a cold launch straight into a running workout) it falls back to whatever
 * `getActive` returns, which is the same session by definition.
 *
 * Sets are written straight through `sets.add`; there is no local mirror of the
 * table. The list re-renders from the Convex subscription, so a set logged on
 * the phone shows up on the web app mid-workout without either side polling.
 * Editing and deleting a logged set is not here yet — that is the set-edit
 * sheet, still to come.
 */
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api, type Doc, type Id } from "../convex/api";
import {
	orderExercisesByFirstSet,
	useActiveSession,
	useSessionSets,
} from "../data/session-data";
import { colors } from "../theme";
import { Chip } from "../ui/coach";
import { convexErrorMessage, useConfirm } from "../ui/confirm-dialog";
import { PlateSheet } from "../ui/plate-sheet";
import { useRestTimer } from "../ui/rest-timer";
import { SetEditSheet } from "../ui/set-edit-sheet";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { AddExercisePicker } from "./add-exercise-picker";
import { HostedSessionPanel } from "./hosted-session-panel";

const SET_TYPES = ["warmup", "working", "drop", "failure"] as const;
type SetType = (typeof SET_TYPES)[number];

/**
 * Per-equipment weight steps, transcribed from the web's
 * `src/lib/exerciseWeightConfig.ts`. A dumbbell rack goes up in 1s and a cable
 * stack in 5s; one step for everything makes the stepper wrong twice.
 */
const EQUIPMENT_STEPS: Record<Doc<"exercises">["equipment"], number> = {
	barbell: 2.5,
	dumbbell: 1,
	cable: 5,
	machine: 5,
	kettlebell: 4,
	band: 2.5,
	bodyweight: 2.5,
	other: 2.5,
};

function weightStepFor(exercise: Doc<"exercises"> | undefined) {
	if (!exercise) return 2.5;
	return exercise.weightIncrement ?? EQUIPMENT_STEPS[exercise.equipment];
}

function formatElapsed(ms: number) {
	const total = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function StrengthSessionScreen() {
	const router = useRouter();
	const toast = useToast();
	const confirm = useConfirm();
	const params = useLocalSearchParams<{ id?: string }>();

	const active = useActiveSession();
	// The pushed id wins; `getActive` is the fallback for a resume that came
	// from the chrome bar rather than from the picker.
	const sessionId = (params.id ?? active?._id) as
		| Id<"workoutSessions">
		| undefined;

	const sets = useSessionSets(sessionId);
	const exercises = useQuery(api.exercises.list, {});

	const finishSession = useMutation(api.workoutSessions.finish);
	const cancelSession = useMutation(api.workoutSessions.cancel);

	const [picking, setPicking] = useState(false);
	/** Exercises added this visit that have no set yet, so nothing to order by. */
	const [pending, setPending] = useState<Id<"exercises">[]>([]);
	const [selected, setSelected] = useState<Id<"exercises"> | null>(null);
	const [busy, setBusy] = useState(false);

	const startTime = active?.startTime;
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);

	const byId = useMemo(() => {
		const map = new Map<Id<"exercises">, Doc<"exercises">>();
		for (const e of exercises ?? []) map.set(e._id, e);
		return map;
	}, [exercises]);

	/** Logged order first, then anything added but not yet logged against. */
	const order = useMemo(() => {
		const logged = orderExercisesByFirstSet(sets ?? []);
		return [...logged, ...pending.filter((id) => !logged.includes(id))];
	}, [sets, pending]);

	// Keep the selection pinned to something that exists, without stomping on a
	// deliberate choice: only auto-select when nothing valid is selected.
	useEffect(() => {
		if (order.length === 0) return;
		if (selected && order.includes(selected)) return;
		setSelected(order[order.length - 1]);
	}, [order, selected]);

	const current = selected ? byId.get(selected) : undefined;
	const currentSets = (sets ?? []).filter((s) => s.exerciseId === selected);

	const finish = async () => {
		if (!sessionId || busy) return;
		setBusy(true);
		try {
			await finishSession({ id: sessionId });
			router.replace({ pathname: "/summary", params: { id: sessionId } });
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not finish the session."));
		} finally {
			setBusy(false);
		}
	};

	const cancel = async () => {
		if (!sessionId || busy) return;
		const confirmed = await confirm({
			title: "Cancel this workout?",
			message: "Sets you already logged are kept.",
			confirmLabel: "Cancel workout",
			cancelLabel: "Keep going",
			destructive: true,
		});
		if (!confirmed) return;
		setBusy(true);
		try {
			await cancelSession({ id: sessionId });
			router.replace("/");
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not cancel the session."));
		} finally {
			setBusy(false);
		}
	};

	if (sessionId === undefined) {
		return (
			<View style={[styles.root, styles.centered]}>
				<AppText variant="heading">No active session</AppText>
				<AppText variant="caption" style={styles.centeredText}>
					Start one from the Start Activity picker.
				</AppText>
				<Pressable onPress={() => router.replace("/")} style={styles.finishBtn}>
					<AppText style={styles.finishText}>Back to home</AppText>
				</Pressable>
			</View>
		);
	}

	return (
		<View style={styles.root}>
			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.header}>
					<Pressable
						onPress={() => router.back()}
						hitSlop={12}
						style={styles.back}
						accessibilityRole="button"
						accessibilityLabel="Go back"
					>
						<AppText style={styles.backText}>‹</AppText>
					</Pressable>
					<View style={styles.flex}>
						<AppText style={styles.h2}>
							{active?.name ?? "Free session"}
						</AppText>
						<View style={styles.row}>
							<View style={styles.dot} />
							<AppText style={styles.elapsed}>
								{startTime ? formatElapsed(now - startTime) : "—"}
							</AppText>
						</View>
					</View>
					<Pressable
						onPress={() => void finish()}
						disabled={busy}
						style={[styles.finishBtn, busy && styles.dimmed]}
					>
						<AppText style={styles.finishText}>Finish</AppText>
					</Pressable>
				</View>

				{order.length === 0 ? (
					<View style={styles.empty}>
						<AppText variant="heading" style={{ color: colors.textMuted }}>
							No exercises yet
						</AppText>
						<AppText variant="caption" style={styles.centeredText}>
							Add one to start logging sets.
						</AppText>
					</View>
				) : (
					<ScrollView horizontal showsHorizontalScrollIndicator={false}>
						<View style={styles.chipRow}>
							{order.map((id) => (
								<Pressable key={id} onPress={() => setSelected(id)}>
									<Chip
										label={byId.get(id)?.name ?? "Exercise"}
										active={id === selected}
									/>
								</Pressable>
							))}
						</View>
					</ScrollView>
				)}

				<Pressable onPress={() => setPicking(true)} style={styles.addBtn}>
					<AppText style={styles.addBtnText}>+ Add exercise</AppText>
				</Pressable>

				{current ? (
					<ExerciseLogger
						key={current._id}
						sessionId={sessionId}
						exercise={current}
						sets={currentSets}
					/>
				) : null}

				{/* Renders only when this session belongs to a hosted workout. */}
				<HostedSessionPanel sessionId={sessionId} />

				<Pressable onPress={() => void cancel()} style={styles.cancelBtn}>
					<AppText style={styles.cancelText}>Cancel workout</AppText>
				</Pressable>
			</ScrollView>

			<AddExercisePicker
				visible={picking}
				exercises={exercises}
				onClose={() => setPicking(false)}
				onSelect={(id) => {
					setPending((prev) => (prev.includes(id) ? prev : [...prev, id]));
					setSelected(id);
					setPicking(false);
				}}
			/>
		</View>
	);
}

/**
 * One exercise's set table and entry form. Split out so that switching
 * exercises remounts it — via the `key` above — which resets the weight and
 * reps fields to that exercise's own history instead of carrying the previous
 * one's numbers across.
 */
function ExerciseLogger({
	sessionId,
	exercise,
	sets,
}: {
	sessionId: Id<"workoutSessions">;
	exercise: Doc<"exercises">;
	sets: Doc<"sets">[];
}) {
	const toast = useToast();
	const rest = useRestTimer();
	const addSet = useMutation(api.sets.add);
	const lastEver = useQuery(api.sets.getLastForExercise, {
		exerciseId: exercise._id,
	});

	const step = weightStepFor(exercise);
	const isBodyweight = exercise.equipment === "bodyweight";
	const isBarbell = exercise.equipment === "barbell";

	const [weight, setWeight] = useState(sets[sets.length - 1]?.weight ?? 0);
	const [reps, setReps] = useState(8);
	const [setType, setSetType] = useState<SetType>("working");
	const [busy, setBusy] = useState(false);
	const [plates, setPlates] = useState(false);
	const [editing, setEditing] = useState<Doc<"sets"> | null>(null);
	// Seeded once: if this session has no sets for the exercise yet, start from
	// whatever the user last lifted for it rather than from zero.
	const [seeded, setSeeded] = useState(sets.length > 0);

	useEffect(() => {
		if (seeded || lastEver === undefined) return;
		setWeight(lastEver?.weight ?? 0);
		setSeeded(true);
	}, [lastEver, seeded]);

	const log = async () => {
		if (reps < 1 || busy) return;
		setBusy(true);
		try {
			await addSet({
				sessionId,
				exerciseId: exercise._id,
				setNumber: sets.length + 1,
				reps,
				weight,
				unit: "kg",
				setType,
			});
			// Warmups run back to back; everything else earns a rest.
			if (setType !== "warmup") rest.start();
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not log that set."));
		} finally {
			setBusy(false);
		}
	};

	return (
		<View style={styles.loggerGap}>
			<View style={styles.between}>
				<AppText style={styles.exerciseName}>{exercise.name}</AppText>
				<AppText style={styles.setCount}>
					{sets.length} set{sets.length === 1 ? "" : "s"}
				</AppText>
			</View>

			<View style={styles.chipRow}>
				{lastEver ? (
					<Chip label={`Last: ${lastEver.weight} × ${lastEver.reps}`} />
				) : null}
				{isBarbell ? (
					<Pressable onPress={() => setPlates(true)}>
						<Chip label="Plates" />
					</Pressable>
				) : null}
			</View>

			<View style={styles.table}>
				<View style={styles.tableHead}>
					<AppText style={[styles.th, { width: 26 }]}>Set</AppText>
					<AppText style={[styles.th, styles.flex]}>Type</AppText>
					<AppText style={[styles.th, styles.center, { width: 60 }]}>
						{isBodyweight ? "+kg" : "kg"}
					</AppText>
					<AppText style={[styles.th, styles.center, { width: 44 }]}>
						Reps
					</AppText>
				</View>
				{sets.length === 0 ? (
					<AppText style={styles.muted}>Nothing logged yet.</AppText>
				) : (
					sets.map((s) => (
						// Tapping a logged row opens the edit sheet — the same
						// affordance the web gives its set cards.
						<Pressable
							key={s._id}
							onPress={() => setEditing(s)}
							style={styles.tableRow}
							accessibilityRole="button"
							accessibilityLabel={`Edit set ${s.setNumber}`}
						>
							<AppText style={[styles.td, styles.bold, { width: 26 }]}>
								{s.setNumber}
							</AppText>
							<AppText style={[styles.td, styles.flex]}>{s.setType}</AppText>
							<AppText
								style={[styles.td, styles.center, styles.bold, { width: 60 }]}
							>
								{s.weight}
							</AppText>
							<AppText
								style={[styles.td, styles.center, styles.bold, { width: 44 }]}
							>
								{s.reps}
							</AppText>
						</Pressable>
					))
				)}
			</View>

			<View style={styles.typeRow}>
				{SET_TYPES.map((t) => (
					<Pressable key={t} onPress={() => setSetType(t)} style={styles.flex}>
						<Chip label={t} active={t === setType} />
					</Pressable>
				))}
			</View>

			<View style={styles.steppers}>
				<Stepper
					label={isBodyweight ? "added kg" : "kg"}
					value={weight}
					step={step}
					onChange={setWeight}
				/>
				<Stepper label="reps" value={reps} step={1} onChange={setReps} />
			</View>

			<Pressable
				onPress={() => void log()}
				disabled={busy || reps < 1}
				style={[styles.logBtn, (busy || reps < 1) && styles.dimmed]}
			>
				<AppText style={styles.logText}>
					{busy ? "Logging…" : `Log set ${sets.length + 1}`}
				</AppText>
			</Pressable>

			<PlateSheet
				visible={plates}
				weight={weight}
				onClose={() => setPlates(false)}
			/>

			{editing ? (
				<SetEditSheet
					set={editing}
					weightStep={step}
					exerciseName={exercise.name}
					onClose={() => setEditing(null)}
				/>
			) : null}
		</View>
	);
}

function Stepper({
	label,
	value,
	step,
	onChange,
}: {
	label: string;
	value: number;
	step: number;
	onChange: (v: number) => void;
}) {
	// Fractional steps (2.5kg) accumulate float error over enough taps; one
	// decimal is finer than any plate anyone owns.
	const round = (n: number) => Math.round(n * 10) / 10;

	return (
		<View style={styles.stepper}>
			<Pressable
				onPress={() => onChange(round(Math.max(0, value - step)))}
				style={styles.stepperBtn}
				hitSlop={8}
				accessibilityRole="button"
				accessibilityLabel={`Decrease ${label}`}
			>
				<AppText style={styles.stepperGlyph}>–</AppText>
			</Pressable>
			<View style={styles.stepperValueWrap}>
				<AppText style={styles.stepperValue}>{value}</AppText>
				<AppText style={styles.stepperLabel}>{label}</AppText>
			</View>
			<Pressable
				onPress={() => onChange(round(value + step))}
				style={styles.stepperBtn}
				hitSlop={8}
				accessibilityRole="button"
				accessibilityLabel={`Increase ${label}`}
			>
				<AppText style={styles.stepperGlyph}>+</AppText>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingTop: 12, gap: 12, paddingBottom: 40 },
	centered: { alignItems: "center", justifyContent: "center", gap: 12 },
	centeredText: { textAlign: "center" },
	header: { flexDirection: "row", alignItems: "center", gap: 10 },
	back: {
		width: 32,
		height: 32,
		borderRadius: 9999,
		backgroundColor: "rgba(255,255,255,0.08)",
		alignItems: "center",
		justifyContent: "center",
	},
	backText: { fontSize: 18, fontWeight: "800", color: colors.text },
	flex: { flex: 1 },
	h2: { fontSize: 16, fontWeight: "800", color: colors.text },
	row: { flexDirection: "row", alignItems: "center", gap: 6 },
	dot: {
		width: 6,
		height: 6,
		borderRadius: 9999,
		backgroundColor: colors.accent,
	},
	elapsed: {
		fontSize: 12,
		fontWeight: "700",
		color: colors.textMuted,
		fontVariant: ["tabular-nums"],
	},
	finishBtn: {
		minHeight: 36,
		paddingHorizontal: 14,
		borderRadius: 9999,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		alignItems: "center",
		justifyContent: "center",
	},
	finishText: { fontSize: 12, fontWeight: "800", color: colors.text },
	dimmed: { opacity: 0.5 },
	empty: {
		alignItems: "center",
		gap: 4,
		paddingVertical: 24,
		backgroundColor: colors.surface,
		borderRadius: 14,
	},
	chipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
	addBtn: {
		minHeight: 44,
		borderRadius: 9999,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		alignItems: "center",
		justifyContent: "center",
	},
	addBtnText: { fontSize: 13, fontWeight: "700", color: colors.text },
	loggerGap: { gap: 10 },
	between: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	exerciseName: { fontSize: 17, fontWeight: "800", color: colors.text },
	setCount: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
	muted: { fontSize: 13, color: colors.textMuted },
	table: { gap: 2 },
	tableHead: {
		flexDirection: "row",
		gap: 6,
		paddingHorizontal: 2,
		paddingBottom: 4,
	},
	th: {
		fontSize: 9,
		fontWeight: "800",
		letterSpacing: 0.5,
		textTransform: "uppercase",
		color: colors.textFaint,
	},
	center: { textAlign: "center" },
	tableRow: { flexDirection: "row", alignItems: "center", gap: 6, height: 34 },
	td: { fontSize: 12, fontWeight: "500", color: colors.textMuted },
	bold: { fontWeight: "800", color: colors.text },
	typeRow: { flexDirection: "row", gap: 6 },
	steppers: { flexDirection: "row", gap: 10, marginTop: 4 },
	stepper: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		height: 56,
		paddingHorizontal: 6,
		borderRadius: 14,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
	},
	stepperBtn: {
		width: 44,
		height: 44,
		borderRadius: 11,
		alignItems: "center",
		justifyContent: "center",
	},
	stepperGlyph: { fontSize: 20, fontWeight: "800", color: colors.textMuted },
	stepperValueWrap: { alignItems: "center" },
	stepperValue: { fontSize: 20, fontWeight: "800", color: colors.text },
	stepperLabel: { fontSize: 9, color: colors.textMuted },
	logBtn: {
		height: 48,
		borderRadius: 9999,
		backgroundColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	logText: { fontSize: 14, fontWeight: "800", color: colors.onAccent },
	cancelBtn: {
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		marginTop: 8,
	},
	cancelText: { fontSize: 13, fontWeight: "700", color: colors.danger },
});
