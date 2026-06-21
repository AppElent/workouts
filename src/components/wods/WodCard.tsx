import type { Doc } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";

const TYPE_LABELS: Record<Doc<"wods">["type"], string> = {
	forTime: "For Time",
	amrap: "AMRAP",
	emom: "EMOM",
	load: "Load",
};

export function WodCard({ wod }: { wod: Doc<"wods"> }) {
	return (
		<Link
			to="/wods/$id"
			params={{ id: wod._id }}
			className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 hover:border-[var(--accent)]/40 transition-colors flex flex-col gap-2"
		>
			<div className="flex items-center justify-between gap-2">
				<span className="text-sm font-semibold text-white truncate">
					{wod.name}
				</span>
				<span className="shrink-0 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--accent-dim)] text-[var(--accent)]">
					{TYPE_LABELS[wod.type]}
				</span>
			</div>
			{wod.repScheme && (
				<span className="text-xs text-[var(--text-muted)]">
					{wod.repScheme}
				</span>
			)}
			<span className="text-xs text-[var(--text-muted)] truncate">
				{wod.movements.map((m) => m.name).join(", ")}
			</span>
		</Link>
	);
}
