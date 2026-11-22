import {
	LOAD_UNITS,
	type LoadUnit,
	type WodScoreFields as ScoreFields,
	type WodType,
} from "@foundry/core";
import { useState } from "react";
import { Stepper } from "#/components/ui/Stepper";
import { useMessages } from "#/lib/i18n";

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
	const t = useMessages().wods.score;
	const reps = (
		<Stepper
			value={draft.reps}
			onChange={(value) => onChange({ reps: value })}
			min={0}
			label={t.reps}
		/>
	);
	switch (type) {
		case "forTime":
			return (
				<>
					<label className="flex items-center gap-2 text-sm text-text">
						<input
							type="checkbox"
							checked={draft.timeCapped}
							onChange={(event) =>
								onChange({ timeCapped: event.target.checked })
							}
						/>
						{t.timeCapped}
					</label>
					{draft.timeCapped ? (
						reps
					) : (
						<div className="grid grid-cols-2 gap-2">
							<Stepper
								value={draft.minutes}
								onChange={(value) => onChange({ minutes: value })}
								min={0}
								unit={t.minutesUnit}
								label={t.minutes}
							/>
							<Stepper
								value={draft.seconds}
								onChange={(value) => onChange({ seconds: value })}
								min={0}
								max={59}
								unit={t.secondsUnit}
								label={t.seconds}
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
						label={t.rounds}
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
						label={t.load}
					/>
					<select
						value={draft.loadUnit}
						onChange={(event) =>
							onChange({ loadUnit: event.target.value as LoadUnit })
						}
						aria-label={t.loadUnit}
						className="h-full rounded-lg border border-border bg-surface-2 px-2 text-sm text-text"
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
