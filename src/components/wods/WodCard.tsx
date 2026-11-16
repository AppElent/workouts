import type { Doc } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { WOD_TYPE_LABELS } from "#/components/hosted/wodBlock";

export function WodCard({ wod }: { wod: Doc<"wods"> }) {
	return (
		<Link
			to="/wods/$id"
			params={{ id: wod._id }}
			className="rounded-xl bg-surface border border-border p-4 hover:border-accent-ink/40 transition-colors flex flex-col gap-2"
		>
			<div className="flex items-center justify-between gap-2">
				<span className="text-sm font-semibold text-text truncate">
					{wod.name}
				</span>
				<span className="shrink-0 text-micro font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-accent-dim text-accent-ink">
					{WOD_TYPE_LABELS[wod.type]}
				</span>
			</div>
			{wod.repScheme && (
				<span className="text-xs text-text-muted">{wod.repScheme}</span>
			)}
			<span className="text-xs text-text-muted truncate">
				{wod.movements.map((m) => m.name).join(", ")}
			</span>
		</Link>
	);
}
