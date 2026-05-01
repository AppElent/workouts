import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { loadFormDraft, saveFormDraft } from "#/hooks/useWorkoutFormDraft";
import { SetCard } from "./SetCard";
import { SetRow } from "./SetRow";

interface Props {
	exerciseId: Id<"exercises">;
	exerciseName: string;
	sessionId: Id<"workoutSessions">;
	sets: Doc<"sets">[];
}

const SET_TYPES = ["warmup", "working", "drop", "failure"] as const;
type SetType = (typeof SET_TYPES)[number];

function Stepper({
	value,
	onChange,
	min = 0,
	max = 9999,
	step = 1,
	unit,
	label,
}: {
	value: number;
	onChange: (v: number) => void;
	min?: number;
	max?: number;
	step?: number;
	unit?: string;
	label: string;
}) {
	const dec = () =>
		onChange(Math.max(min, parseFloat((value - step).toFixed(2))));
	const inc = () =>
		onChange(Math.min(max, parseFloat((value + step).toFixed(2))));

	return (
		<div className="flex items-center gap-3">
			<span className="text-xs text-[var(--text-muted)] uppercase tracking-wide w-12 shrink-0">
				{label}
			</span>
			<div className="flex items-stretch flex-1 h-14 bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
				<button
					type="button"
					onClick={dec}
					className="w-14 flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors touch-manipulation rounded-l-xl"
					aria-label={`Decrease ${label}`}
				>
					<Minus size={18} />
				</button>
				<div className="flex-1 flex items-center justify-center gap-1.5 select-none">
					<span className="text-[22px] font-bold text-white leading-none tabular-nums">
						{value}
					</span>
					{unit && (
						<span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
							{unit}
						</span>
					)}
				</div>
				<button
					type="button"
					onClick={inc}
					className="w-14 flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors touch-manipulation rounded-r-xl"
					aria-label={`Increase ${label}`}
				>
					<Plus size={18} />
				</button>
			</div>
		</div>
	);
}

export function ExerciseSection({
	exerciseId,
	exerciseName,
	sessionId,
	sets,
}: Props) {
	const addSet = useMutation(api.sets.add);
	const lastExerciseSet = useQuery(api.sets.getLastForExercise, { exerciseId });

	const [weight, setWeight] = useState(
		() =>
			loadFormDraft(sessionId, exerciseId)?.weight ??
			sets[sets.length - 1]?.weight ??
			0,
	);
	const [reps, setReps] = useState(
		() => loadFormDraft(sessionId, exerciseId)?.reps ?? 8,
	);
	const [rpe, setRpe] = useState(
		() => loadFormDraft(sessionId, exerciseId)?.rpe ?? 8,
	);
	const [setType, setSetType] = useState<SetType>(
		() => loadFormDraft(sessionId, exerciseId)?.setType ?? "working",
	);
	const [weightInitialized, setWeightInitialized] = useState(
		() => loadFormDraft(sessionId, exerciseId) !== null || sets.length > 0,
	);

	// Once the last-exercise query resolves, seed weight if no sets exist in this session yet
	useEffect(() => {
		if (!weightInitialized && lastExerciseSet !== undefined) {
			setWeight(lastExerciseSet?.weight ?? 0);
			setWeightInitialized(true);
		}
	}, [lastExerciseSet, weightInitialized]);

	// Persist form state to localStorage so it survives page refresh
	useEffect(() => {
		saveFormDraft(sessionId, exerciseId, { weight, reps, rpe, setType });
	}, [weight, reps, rpe, setType, sessionId, exerciseId]);

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
								<SetRow key={set._id} set={set} />
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Mobile: cards */}
			{sets.length > 0 && (
				<div className="flex sm:hidden flex-col gap-2 mb-4">
					{sets.map((set) => (
						<SetCard key={set._id} set={set} />
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
					step={2.5}
					unit="kg"
					label="Weight"
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
					<label className="text-[10px] text-[var(--text-muted)] uppercase">
						Type
					</label>
					<select
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
					<label className="text-[10px] text-[var(--text-muted)] uppercase">
						kg
					</label>
					<input
						type="number"
						min="0"
						step="0.5"
						value={weight}
						onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
						className="w-16 h-8 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label className="text-[10px] text-[var(--text-muted)] uppercase">
						Reps
					</label>
					<input
						type="number"
						min="1"
						value={reps}
						onChange={(e) => setReps(parseInt(e.target.value, 10) || 0)}
						className="w-14 h-8 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label className="text-[10px] text-[var(--text-muted)] uppercase">
						RPE
					</label>
					<input
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
