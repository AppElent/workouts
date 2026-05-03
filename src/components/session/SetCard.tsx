import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { calculateOneRepMax } from "#/lib/oneRepMax";

interface Props {
	set: Doc<"sets">;
}

export function SetCard({ set }: Props) {
	const removeSet = useMutation(api.sets.remove);
	const orm = set.weight > 0 ? calculateOneRepMax(set.weight, set.reps) : null;

	return (
		<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] flex items-stretch">
			<div className="flex items-center gap-3 flex-1 px-3 py-3 min-w-0 overflow-hidden">
				<span className="text-xs text-[var(--text-muted)] w-5 shrink-0">
					#{set.setNumber}
				</span>
				<span className="text-xs text-[var(--text-muted)] capitalize shrink-0">
					{set.setType}
				</span>
				{set.weight > 0 ? (
					<span className="text-sm text-white font-medium shrink-0">
						{set.weight}
						<span className="text-xs text-[var(--text-muted)] ml-0.5">
							{set.unit}
						</span>
					</span>
				) : (
					<span className="text-sm text-[var(--text-muted)] shrink-0">BW</span>
				)}
				<span className="text-sm text-white shrink-0">×{set.reps}</span>
				{set.rpe !== undefined && (
					<span className="text-xs text-[var(--text-muted)] shrink-0">
						RPE {set.rpe}
					</span>
				)}
				{orm && (
					<span className="text-xs text-[var(--text-muted)] shrink-0 ml-auto">
						{orm.value}
						{orm.source === "calculated" ? " est." : ""} 1RM
					</span>
				)}
			</div>
			<button
				type="button"
				onClick={() => void removeSet({ id: set._id })}
				className="px-5 flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 active:text-red-500 border-l border-[var(--border)] transition-colors touch-manipulation rounded-r-lg"
				aria-label="Delete set"
			>
				<Trash2 size={16} />
			</button>
		</div>
	);
}
