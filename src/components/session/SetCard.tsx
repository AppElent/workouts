import type { Doc } from "@convex/_generated/dataModel";
import { ChevronRight } from "lucide-react";
import { calculateOneRepMax } from "#/lib/oneRepMax";

interface Props {
	set: Doc<"sets">;
	onEdit: (set: Doc<"sets">) => void;
}

const TYPE_DOT_COLOR: Record<Doc<"sets">["setType"], string> = {
	warmup: "var(--text-faint)",
	working: "var(--accent)",
	drop: "#fbbf24",
	failure: "#f87171",
};

export function SetCard({ set, onEdit }: Props) {
	const orm = set.weight > 0 ? calculateOneRepMax(set.weight, set.reps) : null;
	const dotColor = TYPE_DOT_COLOR[set.setType];

	return (
		<button
			type="button"
			onClick={() => onEdit(set)}
			className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] flex items-center px-3 py-3 text-left hover:border-[var(--border-strong)] transition-colors"
			aria-label={`Edit set ${set.setNumber}`}
		>
			<div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
				<span
					className="w-1.5 h-1.5 rounded-full shrink-0"
					style={{ background: dotColor }}
				/>
				<span className="text-xs text-[var(--text-muted)] shrink-0 font-semibold">
					#{set.setNumber}
				</span>
				<span className="text-xs text-[var(--text-muted)] capitalize shrink-0">
					{set.setType}
				</span>
				{set.weight > 0 ? (
					<span className="text-sm text-white font-medium shrink-0 tabular-nums">
						{set.weight}
						<span className="text-xs text-[var(--text-muted)] ml-0.5">
							{set.unit}
						</span>
					</span>
				) : (
					<span className="text-sm text-[var(--text-muted)] shrink-0">BW</span>
				)}
				<span className="text-sm text-white shrink-0 tabular-nums">
					×{set.reps}
				</span>
				{set.rpe !== undefined && (
					<span className="text-xs text-[var(--text-muted)] shrink-0">
						RPE {set.rpe}
					</span>
				)}
				{orm && (
					<span className="text-xs text-[var(--text-muted)] shrink-0 ml-auto tabular-nums">
						{orm.value}
						{orm.source === "calculated" ? " est." : ""} 1RM
					</span>
				)}
			</div>
			<ChevronRight
				size={14}
				className="text-[var(--text-faint)] ml-2 shrink-0"
			/>
		</button>
	);
}
