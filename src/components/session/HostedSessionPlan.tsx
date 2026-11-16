import type { ExerciseId } from "@foundry/core/exercises";

export type HostedStrengthBlock = {
	blockId: string;
	exerciseId?: ExerciseId;
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
					className="rounded-xl border border-border bg-surface p-4 sm:p-5"
				>
					<h3 className="text-base font-semibold text-text">
						{block.exerciseName}
					</h3>
					{block.instructions && (
						<p className="mt-2 text-sm text-text-muted">{block.instructions}</p>
					)}
				</div>
			))}
		</>
	);
}
