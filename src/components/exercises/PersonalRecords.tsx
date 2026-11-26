import type { Equipment, LoadUnit, PerformedSet } from "@foundry/core";
import { exerciseRecords } from "@foundry/core";
import { useMessages } from "#/lib/i18n";
import { displayLoad } from "#/lib/load";

export function PersonalRecords({
	history,
	exercise,
	unit,
}: {
	history: readonly PerformedSet[];
	exercise: { equipment: Equipment };
	unit: LoadUnit;
}) {
	const t = useMessages().exercise.records;
	const { heaviest, bestEstimate, bestSetVolume, repMaxes } = exerciseRecords(
		history,
		exercise,
	);
	if (!heaviest || !bestEstimate || !bestSetVolume) return null;
	const load = (kg: number) => `${displayLoad(kg, unit)} ${unit}`;
	const volumeReps = bestSetVolume.set.reps;

	return (
		<div className="rounded-xl bg-surface border border-border p-4">
			<p className="text-micro tracking-widest text-text-muted uppercase mb-3">
				{t.title}
			</p>
			<div className="grid grid-cols-2 gap-3">
				<Stat
					label={t.heaviest}
					value={load(heaviest.valueKg)}
					sub={`× ${heaviest.set.reps}`}
				/>
				<Stat label={t.bestEstimate} value={load(bestEstimate.valueKg)} />
				<Stat
					label={t.bestSetVolume}
					value={`${Math.round(displayLoad(bestSetVolume.valueKg, unit))} ${unit}`}
					sub={`${displayLoad(bestSetVolume.valueKg / volumeReps, unit)}×${volumeReps}`}
				/>
				{repMaxes.length > 0 && (
					<div className="col-span-2 sm:col-span-1">
						<p className="text-micro uppercase tracking-wide text-text-muted mb-1.5">
							{t.repMaxes}
						</p>
						<div className="flex flex-wrap gap-1.5">
							{repMaxes.map((r) => (
								<span
									key={r.reps}
									className="text-eyebrow font-medium tabular-nums rounded-md bg-surface-2 px-2 py-1 text-text"
								>
									<span className="text-text-muted">{r.reps}RM</span>{" "}
									{displayLoad(r.valueKg, unit)}
									{unit}
								</span>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function Stat({
	label,
	value,
	sub,
}: {
	label: string;
	value: string;
	sub?: string;
}) {
	return (
		<div>
			<p className="text-micro uppercase tracking-wide text-text-muted mb-1">
				{label}
			</p>
			<p className="text-base font-bold text-text tabular-nums">
				{value}
				{sub && (
					<span className="text-xs font-normal text-text-muted ml-1">
						{sub}
					</span>
				)}
			</p>
		</div>
	);
}
