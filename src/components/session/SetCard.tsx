import type { Doc } from "@convex/_generated/dataModel";
import { ChevronRight } from "lucide-react";
import { setCount, setReference } from "#/lib/load";

interface Props {
	set: Doc<"sets">;
	/** A hold: the count is seconds. */
	timed: boolean;
	onEdit: (set: Doc<"sets">) => void;
}

const TYPE_DOT_COLOR: Record<Doc<"sets">["setType"], string> = {
	warmup: "var(--text-faint)",
	working: "var(--accent-ink)",
	drop: "var(--warn)",
	failure: "var(--danger)",
};

export function SetCard({ set, timed, onEdit }: Props) {
	const orm = setReference(set);
	const dotColor = TYPE_DOT_COLOR[set.setType];

	return (
		<button
			type="button"
			onClick={() => onEdit(set)}
			className="w-full rounded-lg border border-border bg-surface-2 flex items-center px-3 py-3 text-left hover:border-border-strong transition-colors"
			aria-label={`Edit set ${set.setNumber}${set.notes ? `, note: ${set.notes}` : ""}`}
		>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2 overflow-hidden">
					<span
						className="w-1.5 h-1.5 rounded-full shrink-0"
						style={{ background: dotColor }}
					/>
					<span className="text-xs text-text-muted shrink-0 font-semibold">
						#{set.setNumber}
					</span>
					<span className="text-xs text-text-muted capitalize shrink-0">
						{set.setType}
					</span>
					{set.weight > 0 ? (
						<span className="text-sm text-text font-medium shrink-0 tabular-nums">
							{set.weight}
							<span className="text-xs text-text-muted ml-0.5">{set.unit}</span>
						</span>
					) : (
						<span className="text-sm text-text-muted shrink-0">BW</span>
					)}
					<span className="text-sm text-text shrink-0 tabular-nums">
						×{setCount(set, timed)}
					</span>
					{set.rpe !== undefined && (
						<span className="text-xs text-text-muted shrink-0">
							RPE {set.rpe}
						</span>
					)}
					{orm && (
						<span className="text-xs text-text-muted shrink-0 ml-auto tabular-nums">
							{orm.value}
							{orm.kind === "calculated" ? " est." : ""} 1RM
						</span>
					)}
				</div>
				{set.notes ? (
					<p className="mt-1 text-xs text-text-muted whitespace-pre-wrap break-words">
						{set.notes}
					</p>
				) : null}
			</div>
			<ChevronRight size={14} className="text-text-faint ml-2 shrink-0" />
		</button>
	);
}
