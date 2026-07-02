import {
	formatMovement,
	getHostedLevelLabel,
	type HostedLevel,
	type HostedMovement,
	movementKey,
} from "#/lib/hostedWorkouts";

type LevelEntry = {
	level: HostedLevel;
	label: string;
	movements: HostedMovement[];
};

/**
 * Read-only display of a WOD block's levels and their per-movement
 * prescriptions (weights are per movement, not a single load for the WOD).
 */
export function HostedWodLevels({ levels }: { levels: LevelEntry[] }) {
	return (
		<div className="mt-3 grid gap-2 sm:grid-cols-2">
			{levels.map((level) => (
				<div
					key={level.level}
					className="rounded-lg border border-[var(--border)] px-3 py-2"
				>
					<p className="text-xs font-semibold text-white">
						{level.label || getHostedLevelLabel(level.level)}
					</p>
					<ul className="mt-1 space-y-0.5">
						{level.movements.length === 0 && (
							<li className="text-xs text-[var(--text-muted)]">No movements</li>
						)}
						{level.movements.map((movement) => (
							<li
								key={movementKey(level.level, movement)}
								className="text-xs text-[var(--text-muted)]"
							>
								{formatMovement(movement)}
							</li>
						))}
					</ul>
				</div>
			))}
		</div>
	);
}
