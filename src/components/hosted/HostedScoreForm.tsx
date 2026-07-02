import { useState } from "react";
import { Stepper } from "#/components/ui/Stepper";
import { getConvexErrorMessage } from "#/lib/convexError";
import {
	formatMovement,
	getHostedLevelLabel,
	type HostedLevel,
	type HostedMovement,
	type HostedScore,
	type HostedWodType,
	movementKey,
	validateHostedScore,
} from "#/lib/hostedWorkouts";

type WodBlock = {
	blockId: string;
	name: string;
	type: HostedWodType;
	levels: { level: HostedLevel; label: string; movements?: HostedMovement[] }[];
};

type SubmitPayload = {
	wodBlockId: string;
	level: HostedLevel;
	notes?: string;
} & HostedScore;

type Props = {
	wodBlocks: WodBlock[];
	submitLabel?: string;
	onSubmit: (payload: SubmitPayload) => Promise<unknown>;
};

export function HostedScoreForm({
	wodBlocks,
	submitLabel = "Submit score",
	onSubmit,
}: Props) {
	const [wodBlockId, setWodBlockId] = useState(wodBlocks[0]?.blockId ?? "");
	const selectedWod =
		wodBlocks.find((block) => block.blockId === wodBlockId) ?? wodBlocks[0];
	const [level, setLevel] = useState<HostedLevel>("rx");
	const selectedLevelMovements =
		selectedWod?.levels.find((entry) => entry.level === level)?.movements ?? [];
	const [minutes, setMinutes] = useState(5);
	const [seconds, setSeconds] = useState(0);
	const [timeCapped, setTimeCapped] = useState(false);
	const [rounds, setRounds] = useState(1);
	const [reps, setReps] = useState(0);
	const [load, setLoad] = useState(0);
	const [loadUnit, setLoadUnit] = useState<"kg" | "lbs">("kg");
	const [notes, setNotes] = useState("");
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!selectedWod || saving) return;

		const score = buildScore(selectedWod.type, {
			minutes,
			seconds,
			timeCapped,
			rounds,
			reps,
			load,
			loadUnit,
		});
		const validation = validateHostedScore(selectedWod.type, score);
		if (!validation.ok) {
			setError(validation.message);
			return;
		}

		setSaving(true);
		setError(null);
		setMessage(null);
		try {
			await onSubmit({
				wodBlockId: selectedWod.blockId,
				level,
				notes: notes.trim() || undefined,
				...score,
			});
			setNotes("");
			setMessage("Score submitted.");
		} catch (err) {
			setError(getConvexErrorMessage(err, "Failed to submit score."));
		} finally {
			setSaving(false);
		}
	}

	if (wodBlocks.length === 0) {
		return (
			<div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
				This hosted workout has no WOD scores to submit.
			</div>
		);
	}

	return (
		<form
			onSubmit={(event) => void handleSubmit(event)}
			className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
		>
			<h2 className="text-sm font-semibold text-white">Submit score</h2>

			<label className="flex flex-col gap-1 text-xs font-medium uppercase text-[var(--text-muted)]">
				WOD
				<select
					value={wodBlockId}
					onChange={(event) => setWodBlockId(event.target.value)}
					className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm normal-case text-white"
				>
					{wodBlocks.map((block) => (
						<option key={block.blockId} value={block.blockId}>
							{block.name}
						</option>
					))}
				</select>
			</label>

			<div className="grid grid-cols-4 gap-2">
				{(selectedWod?.levels ?? []).map((entry) => (
					<button
						key={entry.level}
						type="button"
						onClick={() => setLevel(entry.level)}
						className={[
							"h-10 rounded-lg border text-xs font-semibold",
							level === entry.level
								? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
								: "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]",
						].join(" ")}
					>
						{entry.label || getHostedLevelLabel(entry.level)}
					</button>
				))}
			</div>

			{selectedLevelMovements.length > 0 && (
				<ul className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)]">
					{selectedLevelMovements.map((movement) => (
						<li key={movementKey(level, movement)}>
							{formatMovement(movement)}
						</li>
					))}
				</ul>
			)}

			{selectedWod?.type === "forTime" && (
				<>
					<label className="flex items-center gap-2 text-sm text-white">
						<input
							type="checkbox"
							checked={timeCapped}
							onChange={(event) => setTimeCapped(event.target.checked)}
						/>
						Hit the time cap
					</label>
					{timeCapped ? (
						<Stepper value={reps} onChange={setReps} min={0} label="Reps" />
					) : (
						<div className="grid grid-cols-2 gap-2">
							<Stepper
								value={minutes}
								onChange={setMinutes}
								min={0}
								unit="min"
								label="Min"
							/>
							<Stepper
								value={seconds}
								onChange={setSeconds}
								min={0}
								max={59}
								unit="sec"
								label="Sec"
							/>
						</div>
					)}
				</>
			)}

			{selectedWod?.type === "amrap" && (
				<div className="grid grid-cols-2 gap-2">
					<Stepper value={rounds} onChange={setRounds} min={0} label="Rounds" />
					<Stepper value={reps} onChange={setReps} min={0} label="Reps" />
				</div>
			)}

			{selectedWod?.type === "emom" && (
				<Stepper value={reps} onChange={setReps} min={0} label="Reps" />
			)}

			{selectedWod?.type === "load" && (
				<div className="grid grid-cols-[1fr_84px] gap-2">
					<Stepper
						value={load}
						onChange={setLoad}
						min={0}
						step={2.5}
						label="Load"
					/>
					<select
						value={loadUnit}
						onChange={(event) =>
							setLoadUnit(event.target.value as "kg" | "lbs")
						}
						className="h-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm text-white"
					>
						<option value="kg">kg</option>
						<option value="lbs">lbs</option>
					</select>
				</div>
			)}

			<textarea
				placeholder="Notes (optional)"
				value={notes}
				onChange={(event) => setNotes(event.target.value)}
				rows={2}
				className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)]"
			/>

			<button
				type="submit"
				disabled={saving}
				className="h-11 rounded-lg bg-[var(--accent)] text-sm font-bold text-black disabled:opacity-50"
			>
				{saving ? "Submitting..." : submitLabel}
			</button>
			{message && <p className="text-sm text-[var(--accent)]">{message}</p>}
			{error && <p className="text-sm text-red-400">{error}</p>}
		</form>
	);
}

function buildScore(
	type: HostedWodType,
	values: {
		minutes: number;
		seconds: number;
		timeCapped: boolean;
		rounds: number;
		reps: number;
		load: number;
		loadUnit: "kg" | "lbs";
	},
): HostedScore {
	if (type === "forTime") {
		return values.timeCapped
			? { timeCapped: true, reps: values.reps }
			: { timeSeconds: values.minutes * 60 + values.seconds };
	}
	if (type === "amrap") return { rounds: values.rounds, reps: values.reps };
	if (type === "emom") return { reps: values.reps };
	return { load: values.load, loadUnit: values.loadUnit };
}
