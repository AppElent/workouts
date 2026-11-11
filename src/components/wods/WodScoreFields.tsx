import {
	LOAD_UNITS,
	type LoadUnit,
	type WodScoreFields as ScoreFields,
	type WodType,
} from "@foundry/core";
import { useState } from "react";
import { Stepper } from "#/components/ui/Stepper";

type Draft = {
	minutes: number;
	seconds: number;
	timeCapped: boolean;
	rounds: number;
	reps: number;
	load: number;
	loadUnit: LoadUnit;
};

const INITIAL_DRAFT: Draft = {
	minutes: 5,
	seconds: 0,
	timeCapped: false,
	rounds: 1,
	reps: 0,
	load: 0,
	loadUnit: "kg",
};

/** The score being entered, and the fields core builds a WOD score from. */
export function useWodScoreDraft() {
	const [draft, setDraft] = useState(INITIAL_DRAFT);
	const { minutes, seconds, ...rest } = draft;
	const fields: ScoreFields = { timeSeconds: minutes * 60 + seconds, ...rest };
	return {
		draft,
		fields,
		update: (patch: Partial<Draft>) =>
			setDraft((current) => ({ ...current, ...patch })),
	};
}

/** The score inputs a WOD of `type` ranks on. */
export function WodScoreFields({
	type,
	draft,
	onChange,
}: {
	type: WodType;
	draft: Draft;
	onChange: (patch: Partial<Draft>) => void;
}) {
	const reps = (
		<Stepper
			value={draft.reps}
			onChange={(value) => onChange({ reps: value })}
			min={0}
			label="Reps"
		/>
	);
	switch (type) {
		case "forTime":
			return (
				<>
					<label className="flex items-center gap-2 text-sm text-white">
						<input
							type="checkbox"
							checked={draft.timeCapped}
							onChange={(event) =>
								onChange({ timeCapped: event.target.checked })
							}
						/>
						Hit the time cap (didn't finish)
					</label>
					{draft.timeCapped ? (
						reps
					) : (
						<div className="grid grid-cols-2 gap-2">
							<Stepper
								value={draft.minutes}
								onChange={(value) => onChange({ minutes: value })}
								min={0}
								unit="min"
								label="Min"
							/>
							<Stepper
								value={draft.seconds}
								onChange={(value) => onChange({ seconds: value })}
								min={0}
								max={59}
								unit="sec"
								label="Sec"
							/>
						</div>
					)}
				</>
			);
		case "amrap":
			return (
				<div className="grid grid-cols-2 gap-2">
					<Stepper
						value={draft.rounds}
						onChange={(value) => onChange({ rounds: value })}
						min={0}
						label="Rounds"
					/>
					{reps}
				</div>
			);
		case "emom":
			return reps;
		case "load":
			return (
				<div className="grid grid-cols-[1fr_84px] gap-2">
					<Stepper
						value={draft.load}
						onChange={(value) => onChange({ load: value })}
						min={0}
						step={2.5}
						label="Load"
					/>
					<select
						value={draft.loadUnit}
						onChange={(event) =>
							onChange({ loadUnit: event.target.value as LoadUnit })
						}
						aria-label="Load unit"
						className="h-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 text-sm text-white"
					>
						{LOAD_UNITS.map((unit) => (
							<option key={unit} value={unit}>
								{unit}
							</option>
						))}
					</select>
				</div>
			);
	}
}
