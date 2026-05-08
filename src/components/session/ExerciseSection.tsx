import { Stepper } from "#/components/ui/Stepper";
import { getWeightStep } from "#/lib/exerciseWeightConfig";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { SetCard } from "./SetCard";
import { SetRow } from "./SetRow";

interface Props {
	exerciseId: Id<"exercises">;
	exerciseName: string;
	equipment: Doc<"exercises">["equipment"];
	weightIncrement?: number;
	sessionId: Id<"workoutSessions">;
	sets: Doc<"sets">[];
	onEditSet: (set: Doc<"sets">, exerciseName: string, weightStep: number) => void;
}

const SET_TYPES = ["warmup", "working", "drop", "failure"] as const;
type SetType = (typeof SET_TYPES)[number];

export function ExerciseSection({
	exerciseId,
	exerciseName,
	equipment,
	weightIncrement,
	sessionId,
	sets,
	onEditSet,
}: Props) {
	const addSet = useMutation(api.sets.add);
	const lastExerciseSet = useQuery(api.sets.getLastForExercise, { exerciseId });

	const isBodyweight = equipment === "bodyweight";
	const weightStep = getWeightStep(equipment, weightIncrement);

	const handleEdit = (set: Doc<"sets">) =>
		onEditSet(set, exerciseName, weightStep);

	const [weight, setWeight] = useState(sets[sets.length - 1]?.weight ?? 0);
	const [reps, setReps] = useState(8);
	const [rpe, setRpe] = useState(8);
	const [setType, setSetType] = useState<SetType>("working");
	const [weightInitialized, setWeightInitialized] = useState(sets.length > 0);

	// Once the last-exercise query resolves, seed weight if no sets exist in this session yet
	useEffect(() => {
		if (!weightInitialized && lastExerciseSet !== undefined) {
			setWeight(lastExerciseSet?.weight ?? 0);
			setWeightInitialized(true);
		}
	}, [lastExerciseSet, weightInitialized]);

	async function handleLogSet() {
		if (reps < 1) return;
		await addSet({
			sessionId,
			exerciseId,
			setNumber: sets.length + 1,
			reps,
			weight,
			unit: "kg",
			rpe,
			setType,
		});
	}

	return (
		<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-5">
			<h3 className="text-base font-semibold text-white mb-4">
				{exerciseName}
			</h3>

			{/* Desktop: table */}
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

			{/* Mobile: cards */}
			{sets.length > 0 && (
				<div className="flex sm:hidden flex-col gap-2 mb-4">
					{sets.map((set) => (
						<SetCard key={set._id} set={set} onEdit={handleEdit} />
					))}
				</div>
			)}

			{/* Mobile: stepper form */}
			<div className="flex flex-col gap-2.5 sm:hidden">
				<p className="text-xs text-[var(--text-muted)]">
					Set {sets.length + 1}
				</p>

				<Stepper
					value={weight}
					onChange={setWeight}
					step={weightStep}
					unit="kg"
					label={isBodyweight ? "Added weight" : "Weight"}
				/>

				<Stepper
					value={reps}
					onChange={setReps}
					step={1}
					min={1}
					max={100}
					label="Reps"
				/>
				<Stepper
					value={rpe}
					onChange={setRpe}
					step={0.5}
					min={1}
					max={10}
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
					onClick={() => void handleLogSet()}
					disabled={reps < 1}
					className="w-full h-12 rounded-full bg-[var(--accent)] text-black text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:pointer-events-none mt-1"
				>
					<Plus size={18} />
					Log set
				</button>
			</div>

			{/* Desktop: compact form */}
			<form
				onSubmit={(e) => {
					e.preventDefault();
					void handleLogSet();
				}}
				className="hidden sm:flex flex-wrap items-end gap-2"
			>
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
						min="0"
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
						min="1"
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
						min="1"
						max="10"
						step="0.5"
						value={rpe}
						onChange={(e) => setRpe(parseFloat(e.target.value) || 8)}
						className="w-14 h-8 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
					/>
				</div>
				<button
					type="submit"
					disabled={reps < 1}
					className="h-8 flex items-center gap-1 px-3 rounded border border-[var(--accent)]/40 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent-dim)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
				>
					<Plus size={13} />
					Log set
				</button>
			</form>
		</div>
	);
}
