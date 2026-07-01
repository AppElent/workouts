import type { Id } from "@convex/_generated/dataModel";

export type HostedStrengthBlock = {
	blockId: string;
	exerciseId?: Id<"exercises">;
	exerciseName: string;
	instructions?: string;
};

export function HostedSessionPlan({
	strengthBlocks,
}: {
	strengthBlocks: HostedStrengthBlock[];
}) {
	const unlinkedBlocks = strengthBlocks.filter((block) => !block.exerciseId);
	if (unlinkedBlocks.length === 0) return null;

	return (
		<>
			{unlinkedBlocks.map((block) => (
				<div
					key={block.blockId}
					className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
				>
					<h3 className="text-base font-semibold text-white">
						{block.exerciseName}
					</h3>
					{block.instructions && (
						<p className="mt-2 text-sm text-[var(--text-muted)]">
							{block.instructions}
						</p>
					)}
				</div>
			))}
		</>
	);
}
