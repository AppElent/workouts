import { Trash2 } from "lucide-react";
import {
	formatHostedScore,
	getHostedLevelLabel,
	type HostedLeaderboardRow,
	type HostedWodType,
	sortHostedLeaderboard,
} from "#/lib/hostedWorkouts";

export function HostedLeaderboard({
	type,
	rows,
	onRemove,
}: {
	type: HostedWodType;
	rows: HostedLeaderboardRow[];
	onRemove?: (id: string) => void;
}) {
	const sortedRows = sortHostedLeaderboard(type, rows);
	const columns = onRemove
		? "grid-cols-[44px_1fr_76px_92px_44px]"
		: "grid-cols-[32px_1fr_52px_86px]";

	return (
		<div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]">
			<div
				className={`grid ${columns} gap-2 border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase text-[var(--text-muted)]`}
			>
				<span>#</span>
				<span>Athlete</span>
				<span>Level</span>
				<span>Score</span>
				{onRemove && <span />}
			</div>
			{sortedRows.length === 0 && (
				<p className="px-3 py-4 text-sm text-[var(--text-muted)]">
					No scores yet.
				</p>
			)}
			{sortedRows.map((row, index) => (
				<div
					key={row.id}
					className={`grid ${columns} items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-sm last:border-0`}
				>
					<span className="text-[var(--text-muted)]">{index + 1}</span>
					<span className="font-medium text-white">{row.name}</span>
					<span className="text-[var(--text-muted)]">
						{getHostedLevelLabel(row.level)}
					</span>
					<span className="text-white">
						{formatHostedScore(type, row.score)}
					</span>
					{onRemove && (
						<button
							type="button"
							aria-label="Remove score"
							onClick={() => onRemove(row.id)}
							className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-300"
						>
							<Trash2 size={15} />
						</button>
					)}
				</div>
			))}
		</div>
	);
}
