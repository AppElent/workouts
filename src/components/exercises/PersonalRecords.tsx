import { calculateOneRepMax } from "#/lib/oneRepMax";

interface HistorySet {
	weight: number;
	reps: number;
	unit: "kg" | "lbs";
}

const REP_TARGETS = [1, 3, 5, 10] as const;

export function PersonalRecords({ history }: { history: HistorySet[] }) {
	const working = history.filter((s) => s.weight > 0);
	if (working.length === 0) return null;

	const unit = working[0].unit;

	// Heaviest single set (by weight, tie-broken by reps).
	let heaviest = working[0];
	for (const s of working) {
		if (s.weight > heaviest.weight) heaviest = s;
	}

	// Best estimated 1RM across all sets.
	let bestE1rm = 0;
	for (const s of working) {
		const e = calculateOneRepMax(s.weight, s.reps).value;
		if (e > bestE1rm) bestE1rm = e;
	}

	// Best volume in a single set (weight × reps).
	let bestVolume = working[0];
	for (const s of working) {
		if (s.weight * s.reps > bestVolume.weight * bestVolume.reps) bestVolume = s;
	}

	// Rep PRs: heaviest weight ever lifted for each target rep count.
	const repPrs = REP_TARGETS.map((reps) => {
		const max = working
			.filter((s) => s.reps === reps)
			.reduce((m, s) => (s.weight > m ? s.weight : m), 0);
		return { reps, weight: max };
	}).filter((r) => r.weight > 0);

	return (
		<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
			<p className="text-[9px] tracking-widest text-[var(--text-muted)] uppercase mb-3">
				Personal records
			</p>
			<div className="grid grid-cols-2 gap-3">
				<Stat
					label="Heaviest set"
					value={`${heaviest.weight} ${unit}`}
					sub={`× ${heaviest.reps}`}
				/>
				<Stat label="Best est. 1RM" value={`${bestE1rm} ${unit}`} />
				<Stat
					label="Best set volume"
					value={`${Math.round(bestVolume.weight * bestVolume.reps)} ${unit}`}
					sub={`${bestVolume.weight}×${bestVolume.reps}`}
				/>
				{repPrs.length > 0 && (
					<div className="col-span-2 sm:col-span-1">
						<p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
							Rep maxes
						</p>
						<div className="flex flex-wrap gap-1.5">
							{repPrs.map((r) => (
								<span
									key={r.reps}
									className="text-[11px] font-medium tabular-nums rounded-md bg-[var(--surface-2)] px-2 py-1 text-white"
								>
									<span className="text-[var(--text-muted)]">{r.reps}RM</span>{" "}
									{r.weight}
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
