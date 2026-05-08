import type { Doc } from "@convex/_generated/dataModel";
import { Pencil } from "lucide-react";
import { calculateOneRepMax } from "#/lib/oneRepMax";

interface Props {
	set: Doc<"sets">;
	onEdit: (set: Doc<"sets">) => void;
}

export function SetRow({ set, onEdit }: Props) {
	const orm = set.weight > 0 ? calculateOneRepMax(set.weight, set.reps) : null;

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
				{set.weight > 0 ? (
					<>
						<span className="text-white font-medium">{set.weight}</span>
						<span className="text-xs text-[var(--text-muted)] ml-0.5">
							{set.unit}
						</span>
					</>
				) : (
					<span className="text-[var(--text-muted)]">BW</span>
				)}
			</td>
			<td className="py-2 pr-3 w-16">
				<span className="text-white">{set.reps}</span>
			</td>
			<td className="py-2 pr-3 w-16">
				<span className="text-[var(--text-muted)]">{set.rpe ?? "—"}</span>
			</td>
			<td className="py-2 pr-3 w-24">
				<span className="text-xs text-[var(--text-muted)]">
					{orm
						? `${orm.value} ${orm.source === "calculated" ? "est." : "actual"}`
						: "—"}
				</span>
			</td>
			<td className="py-2 pr-2 w-10">
				<button
					type="button"
					onClick={() => onEdit(set)}
					className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
					aria-label={`Edit set ${set.setNumber}`}
				>
					<Pencil size={13} />
				</button>
			</td>
		</tr>
	);
}
