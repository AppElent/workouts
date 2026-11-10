import type { Doc } from "@convex/_generated/dataModel";
import {
	formatMovement,
	formatScore,
	type HostedLevel,
	type LeaderboardEntry,
	sortLeaderboard,
} from "@foundry/core";
import { Trash2 } from "lucide-react";
import {
	formatWodTiming,
	type HostedWodBlock,
	levelLabel,
	movementKey,
} from "#/components/hosted/wodBlock";

type StrengthBlock =
	Doc<"hostedWorkouts">["template"]["strengthBlocks"][number];

export function HostedStrengthBlocks({ blocks }: { blocks: StrengthBlock[] }) {
	if (blocks.length === 0) return null;
	return (
		<section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
			<h2 className="text-sm font-semibold text-white">Strength</h2>
			<div className="mt-3 grid gap-3 sm:grid-cols-2">
				{blocks.map((block) => (
					<div
						key={block.blockId}
						className="rounded-lg border border-[var(--border)] px-3 py-2"
					>
						<p className="font-medium text-white">{block.exerciseName}</p>
						{block.instructions && (
							<p className="mt-1 text-sm text-[var(--text-muted)]">
								{block.instructions}
							</p>
						)}
					</div>
				))}
			</div>
		</section>
	);
}

export type LeaderboardRow<RowId extends string = string> = LeaderboardEntry & {
	id: RowId;
	name: string;
	level: HostedLevel;
};

/** A WOD block with its levels and its leaderboard, best score first. */
export function HostedWodBlockCard<RowId extends string>({
	block,
	rows,
	onRemove,
}: {
	block: Omit<HostedWodBlock, "wodId">;
	rows: LeaderboardRow<RowId>[];
	onRemove?: (id: RowId) => void;
}) {
	const timing = formatWodTiming(block);
	return (
		<section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
			<div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="text-sm font-semibold text-white">{block.name}</h2>
					{block.repScheme && (
						<p className="text-xs text-[var(--accent)]">{block.repScheme}</p>
					)}
					{timing && (
						<p className="text-xs text-[var(--text-muted)]">{timing}</p>
					)}
					{block.description && (
						<p className="mt-1 text-sm text-[var(--text-muted)]">
							{block.description}
						</p>
					)}
				</div>
				<span className="text-xs uppercase text-[var(--text-muted)]">
					{block.type}
				</span>
			</div>
			<div className="mt-3 grid gap-2 sm:grid-cols-2">
				{block.levels.map((level) => (
					<div
						key={level.level}
						className="rounded-lg border border-[var(--border)] px-3 py-2"
					>
						<p className="text-xs font-semibold text-white">
							{levelLabel(block, level.level)}
						</p>
						<ul className="mt-1 space-y-0.5">
							{level.movements.length === 0 && (
								<li className="text-xs text-[var(--text-muted)]">
									No movements
								</li>
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
			<Leaderboard block={block} rows={rows} onRemove={onRemove} />
		</section>
	);
}

function Leaderboard<RowId extends string>({
	block,
	rows,
	onRemove,
}: {
	block: Omit<HostedWodBlock, "wodId">;
	rows: LeaderboardRow<RowId>[];
	onRemove?: (id: RowId) => void;
}) {
	const sortedRows = sortLeaderboard(block.type, rows);
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
						{levelLabel(block, row.level)}
					</span>
					<span className="text-white">
						{formatScore(block.type, row.score)}
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
