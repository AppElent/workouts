import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Stepper } from "#/components/ui/Stepper";

interface Props {
	wodId: Id<"wods">;
	type: Doc<"wods">["type"];
	sessionId?: Id<"workoutSessions">;
	onLogged?: () => void;
}

export function LogWodResultForm({ wodId, type, sessionId, onLogged }: Props) {
	const log = useMutation(api.wodResults.log);

	const [rxScaled, setRxScaled] = useState<"rx" | "scaled">("rx");
	const [minutes, setMinutes] = useState(5);
	const [seconds, setSeconds] = useState(0);
	const [timeCapped, setTimeCapped] = useState(false);
	const [rounds, setRounds] = useState(1);
	const [reps, setReps] = useState(0);
	const [load, setLoad] = useState(0);
	const [notes, setNotes] = useState("");
	const [saving, setSaving] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		try {
			const base = {
				wodId,
				sessionId,
				rxScaled,
				notes: notes.trim() || undefined,
			};
			if (type === "forTime") {
				await log({
					...base,
					timeCapped: timeCapped || undefined,
					timeSeconds: timeCapped ? undefined : minutes * 60 + seconds,
					reps: timeCapped ? reps : undefined,
				});
			} else if (type === "amrap") {
				await log({ ...base, rounds, reps });
			} else if (type === "emom") {
				await log({ ...base, reps });
			} else {
				await log({ ...base, load, loadUnit: "kg" });
			}
			setNotes("");
			onLogged?.();
		} finally {
			setSaving(false);
		}
	}

	return (
		<form
			onSubmit={(e) => void handleSubmit(e)}
			className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 flex flex-col gap-3"
		>
			<h2 className="text-sm font-semibold text-white">Log Result</h2>

			{type === "forTime" && (
				<>
					<label className="flex items-center gap-2 text-sm text-white">
						<input
							type="checkbox"
							checked={timeCapped}
							onChange={(e) => setTimeCapped(e.target.checked)}
						/>
						Hit the time cap (didn't finish)
					</label>
					{timeCapped ? (
						<Stepper
							value={reps}
							onChange={setReps}
							min={0}
							step={1}
							label="Reps"
						/>
					) : (
						<div className="flex gap-2">
							<Stepper
								value={minutes}
								onChange={setMinutes}
								min={0}
								step={1}
								unit="min"
								label="Min"
							/>
							<Stepper
								value={seconds}
								onChange={setSeconds}
								min={0}
								max={59}
								step={1}
								unit="sec"
								label="Sec"
							/>
						</div>
					)}
				</>
			)}

			{type === "amrap" && (
				<>
					<Stepper
						value={rounds}
						onChange={setRounds}
						min={0}
						step={1}
						label="Rounds"
					/>
					<Stepper
						value={reps}
						onChange={setReps}
						min={0}
						step={1}
						label="Reps"
					/>
				</>
			)}

			{type === "emom" && (
				<Stepper
					value={reps}
					onChange={setReps}
					min={0}
					step={1}
					label="Reps"
				/>
			)}

			{type === "load" && (
				<Stepper
					value={load}
					onChange={setLoad}
					min={0}
					step={2.5}
					unit="kg"
					label="Load"
				/>
			)}

			<div className="flex gap-2">
				{(["rx", "scaled"] as const).map((v) => (
					<button
						key={v}
						type="button"
						onClick={() => setRxScaled(v)}
						className={[
							"flex-1 h-9 rounded-lg text-xs font-medium uppercase transition-all",
							rxScaled === v
								? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/50"
								: "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] hover:text-white",
						].join(" ")}
					>
						{v}
					</button>
				))}
			</div>

			<textarea
				placeholder="Notes (optional)"
				value={notes}
				onChange={(e) => setNotes(e.target.value)}
				rows={2}
				className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
			/>

			<button
				type="submit"
				disabled={saving}
				className="w-full h-11 rounded-full bg-[var(--accent)] text-black text-sm font-bold disabled:opacity-40 hover:bg-[var(--accent-hover)] transition-colors"
			>
				Log Result
			</button>
		</form>
	);
}
