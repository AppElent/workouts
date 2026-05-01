import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { calculateOneRepMax } from "#/lib/oneRepMax";

interface Props {
	set: Doc<"sets">;
}

export function SetRow({ set }: Props) {
	const removeSet = useMutation(api.sets.remove);
	const orm = calculateOneRepMax(set.weight, set.reps);

	return (
		<tr className="border-b border-[var(--border)] last:border-0 text-sm">
			<td className="py-2 pl-2 pr-3 text-[var(--text-muted)] w-8">
				{set.setNumber}
			</td>
			<td className="py-2 pr-3 w-24">
				<span className="text-xs capitalize text-[var(--text-muted)]">
					{set.setType}
				</span>
			</td>
			<td className="py-2 pr-3 w-24">
				<span className="text-white font-medium">{set.weight}</span>
				<span className="text-xs text-[var(--text-muted)] ml-0.5">
					{set.unit}
				</span>
			</td>
			<td className="py-2 pr-3 w-16">
				<span className="text-white">{set.reps}</span>
			</td>
			<td className="py-2 pr-3 w-16">
				<span className="text-[var(--text-muted)]">{set.rpe ?? "—"}</span>
			</td>
			<td className="py-2 pr-3 w-24">
				<span className="text-xs text-[var(--text-muted)]">
					{orm.value} {orm.source === "calculated" ? "est." : "actual"}
				</span>
			</td>
			<td className="py-2 pr-2 w-10">
				<button
					type="button"
					onClick={() => void removeSet({ id: set._id })}
					className="p-1.5 text-[var(--text-muted)] hover:text-red-400 transition-colors"
					aria-label="Delete set"
				>
					<Trash2 size={13} />
				</button>
			</td>
		</tr>
	);
}
