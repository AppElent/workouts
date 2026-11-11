import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import {
	convertLoad,
	getWeightStep,
	isLoadedEquipment,
	type LoadUnit,
	SET_LIMITS,
	SET_TYPES,
	type SetType,
	validateSetInput,
} from "@foundry/core";
import type { Exercise, ExerciseId } from "@foundry/core/exercises";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { ChevronUp, Plus, Weight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Stepper } from "#/components/ui/Stepper";
import { useToast } from "#/components/ui/toast";
import { useConvexErrorMessage } from "#/lib/convexError";
import { PlateSheet } from "./PlateSheet";
import { useRestTimer } from "./RestTimer";
import { SetCard } from "./SetCard";
import { SetRow } from "./SetRow";

interface Props {
	exerciseId: ExerciseId;
	exerciseName: string;
	equipment: Exercise["equipment"];
	weightIncrement?: number;
	sessionId: Id<"workoutSessions">;
	sets: Doc<"sets">[];
	plannedSets: { reps: number; weight: number; unit: LoadUnit }[];
	repeated: Doc<"sets"> | null;
	busy: boolean;
	write: (action: () => Promise<unknown>) => Promise<boolean>;
	onEditSet: (
		set: Doc<"sets">,
		exerciseName: string,
		weightStep: number,
	) => void;
}

export function ExerciseSection({
	exerciseId,
	exerciseName,
	equipment,
	weightIncrement,
	sessionId,
	sets,
	onEditSet,
	plannedSets,
	repeated,
	busy,
	write,
}: Props) {
	const toast = useToast();
	const errorMessage = useConvexErrorMessage();
	const [attempt, setAttempt] = useState<FunctionArgs<
		typeof api.sets.add
	> | null>(null);
	const locked = busy || attempt !== null;
	const addSet = useMutation(api.sets.add);
	const { start: startRest } = useRestTimer();
	const lastExerciseSet = useQuery(api.sets.getLastForExercise, {
		exerciseId,
		excludeSessionId: sessionId,
	});

	const isBodyweight = !isLoadedEquipment(equipment);
	const weightStep = getWeightStep(equipment, weightIncrement);

	const handleEdit = (set: Doc<"sets">) =>
		onEditSet(set, exerciseName, weightStep);

	const [weight, setWeight] = useState(() => {
		const previous = sets.at(-1);
		return previous ? convertLoad(previous.weight, previous.unit, "kg") : 0;
	});
	const [reps, setReps] = useState(8);
	const [rpe, setRpe] = useState<number | undefined>(undefined);
	const [setType, setSetType] = useState<SetType>("working");
	const [weightInitialized, setWeightInitialized] = useState(sets.length > 0);
	const [expanded, setExpanded] = useState(false);
	const [showPlates, setShowPlates] = useState(false);

	const consumedRepeat = useRef<Doc<"sets"> | null>(null);
	const valid = validateSetInput({ weight, reps, rpe }).ok;
	const isBarbell = equipment === "barbell";
	useEffect(() => {
		if (!repeated || attempt || consumedRepeat.current === repeated) return;
		consumedRepeat.current = repeated;
		setWeight(convertLoad(repeated.weight, repeated.unit, "kg"));
		setReps(repeated.reps);
		setRpe(repeated.rpe);
		setSetType(repeated.setType);
		setExpanded(true);
		setWeightInitialized(true);
	}, [repeated, attempt]);

	useEffect(() => {
		if (!weightInitialized && lastExerciseSet !== undefined) {
			const source = plannedSets[sets.length] ?? lastExerciseSet;
			setWeight(source ? convertLoad(source.weight, source.unit, "kg") : 0);
			setReps(plannedSets[sets.length]?.reps ?? 8);
			setWeightInitialized(true);
		}
	}, [lastExerciseSet, weightInitialized, plannedSets, sets.length]);

	async function handleLogSet() {
		if (!valid || busy) return;
		const payload = attempt ?? {
			operationId: crypto.randomUUID(),
			sessionId,
			exerciseId,
			setNumber: sets.reduce((max, set) => Math.max(max, set.setNumber), 0) + 1,
			reps,
			weight,
			unit: "kg" as const,
			rpe,
			setType,
		};
		try {
			const saved = await write(() => {
				setAttempt(payload);
				return addSet(payload);
			});
			if (!saved) return;
			setAttempt(null);
			if (payload.setType !== "warmup") startRest();
		} catch (error) {
			if (error instanceof ConvexError) setAttempt(null);
			toast.error(
				"Couldn't log set",
				errorMessage(error, "Your input is kept. Please try again."),
			);
		}
	}

	return (
		<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-5">
			<div className="flex items-center justify-between gap-2 mb-4">
				<h3 className="text-base font-semibold text-white">{exerciseName}</h3>
				{isBarbell && (
					<button
						type="button"
						onClick={() => setShowPlates(true)}
						className="flex items-center gap-1.5 shrink-0 px-2.5 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-colors"
					>
						<Weight size={14} />
						Plates
					</button>
				)}
			</div>

			{!valid && (
				<p role="alert" className="text-sm text-[var(--text-muted)]">
					Enter weight up to {SET_LIMITS.weight.max} kg, {SET_LIMITS.reps.min}–
					{SET_LIMITS.reps.max} whole reps, and optional RPE from{" "}
					{SET_LIMITS.rpe.min} to {SET_LIMITS.rpe.max} in half steps.
				</p>
			)}
			{plannedSets.length > sets.length ? (
				<p className="text-xs text-[var(--text-muted)] mb-3">
					{plannedSets.length - sets.length} planned sets remaining ·{" "}
					{plannedSets[sets.length]?.weight} {plannedSets[sets.length]?.unit} ×{" "}
					{plannedSets[sets.length]?.reps}
				</p>
			) : null}
			{sets.length > 0 && (
				<div className="hidden sm:block mb-4 overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-[var(--border)]">
								{["#", "Type", "Weight", "Reps", "RPE", "Est. 1RM", ""].map(
									(h) => (
										<th
											key={h}
											className="text-left pb-2 text-xs text-[var(--text-muted)] font-medium pr-3 first:pl-2 whitespace-nowrap"
										>
											{h}
										</th>
									),
								)}
							</tr>
						</thead>
						<tbody>
							{sets.map((set) => (
								<SetRow key={set._id} set={set} onEdit={handleEdit} />
							))}
						</tbody>
					</table>
				</div>
			)}

			{sets.length > 0 && (
				<div className="flex sm:hidden flex-col gap-2 mb-4">
					{sets.map((set) => (
						<SetCard key={set._id} set={set} onEdit={handleEdit} />
					))}
				</div>
			)}

			{!expanded && (
				<button
					type="button"
					onClick={() => setExpanded(true)}
					aria-expanded={false}
					className="sm:hidden w-full h-12 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center gap-2 px-4 text-left active:scale-[0.98] transition-transform"
				>
					<Plus size={18} className="text-[var(--accent)] shrink-0" />
					<span className="text-sm font-semibold text-white shrink-0">
						Add set
					</span>
					<span className="text-xs text-[var(--text-muted)] truncate ml-1 tabular-nums">
						{isBodyweight
							? weight > 0
								? `BW +${weight} kg`
								: "BW"
							: `${weight} kg`}{" "}
						· {reps} reps · <span className="capitalize">{setType}</span>
					</span>
				</button>
			)}

			<div
				className={`flex-col gap-2.5 sm:hidden ${expanded ? "flex" : "hidden"}`}
			>
				<div className="flex items-center justify-between">
					<p className="text-xs text-[var(--text-muted)]">
						Set {sets.length + 1}
					</p>
					<button
						type="button"
						onClick={() => setExpanded(false)}
						aria-label="Collapse add set form"
						className="p-1 text-[var(--text-muted)] hover:text-white transition-colors"
					>
						<ChevronUp size={16} />
					</button>
				</div>

				<fieldset disabled={locked} className="contents">
					<Stepper
						value={weight}
						onChange={setWeight}
						step={weightStep}
						min={SET_LIMITS.weight.min}
						max={SET_LIMITS.weight.max}
						unit="kg"
						label={isBodyweight ? "Added weight" : "Weight"}
					/>

					<Stepper
						value={reps}
						onChange={setReps}
						step={SET_LIMITS.reps.step}
						min={SET_LIMITS.reps.min}
						max={SET_LIMITS.reps.max}
						label="Reps"
					/>
					<Stepper
						value={rpe ?? 8}
						onChange={setRpe}
						step={SET_LIMITS.rpe.step}
						min={SET_LIMITS.rpe.min}
						max={SET_LIMITS.rpe.max}
						label="RPE"
					/>

					<div className="flex gap-1.5 mt-1">
						{SET_TYPES.map((type) => (
							<button
								key={type}
								type="button"
								onClick={() => setSetType(type)}
								className={[
									"flex-1 h-9 rounded-lg text-xs font-medium capitalize transition-all touch-manipulation",
									setType === type
										? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/50"
										: "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] hover:text-white",
								].join(" ")}
							>
								{type}
							</button>
						))}
					</div>

					<button
						type="button"
						onClick={() => setRpe(undefined)}
						className="text-xs text-[var(--text-muted)]"
					>
						{rpe === undefined ? "RPE not recorded" : "Clear RPE"}
					</button>
				</fieldset>
				<button
					type="button"
					onClick={() => void handleLogSet()}
					disabled={!valid || busy}
					className="w-full h-12 rounded-full bg-[var(--accent)] text-black text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:pointer-events-none mt-1"
				>
					<Plus size={18} />
					Log set
				</button>
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					void handleLogSet();
				}}
				className="hidden sm:flex flex-wrap items-end gap-2"
			>
				<fieldset disabled={locked} className="contents">
					<div className="flex flex-col gap-1">
						<label
							htmlFor="set-type"
							className="text-[10px] text-[var(--text-muted)] uppercase"
						>
							Type
						</label>
						<select
							id="set-type"
							value={setType}
							onChange={(e) => setSetType(e.target.value as SetType)}
							className="h-8 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
						>
							{SET_TYPES.map((t) => (
								<option key={t} value={t} className="capitalize">
									{t}
								</option>
							))}
						</select>
					</div>

					<div className="flex flex-col gap-1">
						<label
							htmlFor="set-weight"
							className="text-[10px] text-[var(--text-muted)] uppercase"
						>
							{isBodyweight ? "added kg" : "kg"}
						</label>
						<input
							id="set-weight"
							type="number"
							min={SET_LIMITS.weight.min}
							max={SET_LIMITS.weight.max}
							step={weightStep}
							value={weight}
							onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
							className="w-16 h-8 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
						/>
					</div>

					<div className="flex flex-col gap-1">
						<label
							htmlFor="set-reps"
							className="text-[10px] text-[var(--text-muted)] uppercase"
						>
							Reps
						</label>
						<input
							id="set-reps"
							type="number"
							min={SET_LIMITS.reps.min}
							max={SET_LIMITS.reps.max}
							value={reps}
							onChange={(e) => setReps(parseInt(e.target.value, 10) || 0)}
							className="w-14 h-8 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="set-rpe"
							className="text-[10px] text-[var(--text-muted)] uppercase"
						>
							RPE
						</label>
						<input
							id="set-rpe"
							type="number"
							min={SET_LIMITS.rpe.min}
							max={SET_LIMITS.rpe.max}
							step={SET_LIMITS.rpe.step}
							value={rpe ?? ""}
							onChange={(e) =>
								setRpe(
									e.target.value === "" ? undefined : Number(e.target.value),
								)
							}
							className="w-14 h-8 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
						/>
					</div>
				</fieldset>
				<button
					type="submit"
					disabled={!valid || busy}
					className="h-8 flex items-center gap-1 px-3 rounded border border-[var(--accent)]/40 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent-dim)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
				>
					<Plus size={13} />
					Log set
				</button>
			</form>

			<PlateSheet
				open={showPlates}
				weight={weight}
				unit="kg"
				exerciseName={exerciseName}
				onClose={() => setShowPlates(false)}
			/>
		</div>
	);
}
