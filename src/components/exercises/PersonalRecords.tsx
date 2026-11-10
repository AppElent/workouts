import type { Equipment, LoadUnit, PerformedSet } from "@foundry/core";
import { exerciseRecords } from "@foundry/core";
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
	const { heaviest, bestEstimate, bestSetVolume, repMaxes } = exerciseRecords(
		history,
		exercise,
	);
	if (!heaviest || !bestEstimate || !bestSetVolume) return null;
	const load = (kg: number) => `${displayLoad(kg, unit)} ${unit}`;
	const volumeReps = bestSetVolume.set.reps;

	return (
		<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
			<p className="text-[9px] tracking-widest text-[var(--text-muted)] uppercase mb-3">
				Personal records
			</p>
			<div className="grid grid-cols-2 gap-3">
				<Stat
					label="Heaviest set"
					value={load(heaviest.valueKg)}
					sub={`× ${heaviest.set.reps}`}
				/>
				<Stat label="Best est. 1RM" value={load(bestEstimate.valueKg)} />
				<Stat
					label="Best set volume"
					value={`${Math.round(displayLoad(bestSetVolume.valueKg, unit))} ${unit}`}
					sub={`${displayLoad(bestSetVolume.valueKg / volumeReps, unit)}×${volumeReps}`}
				/>
				{repMaxes.length > 0 && (
					<div className="col-span-2 sm:col-span-1">
						<p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
							Rep maxes
						</p>
						<div className="flex flex-wrap gap-1.5">
							{repMaxes.map((r) => (
								<span
									key={r.reps}
									className="text-[11px] font-medium tabular-nums rounded-md bg-[var(--surface-2)] px-2 py-1 text-white"
								>
									<span className="text-[var(--text-muted)]">{r.reps}RM</span>{" "}
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
			<p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
				{label}
			</p>
			<p className="text-base font-bold text-white tabular-nums">
				{value}
				{sub && (
					<span className="text-xs font-normal text-[var(--text-muted)] ml-1">
						{sub}
					</span>
				)}
			</p>
		</div>
	);
}
