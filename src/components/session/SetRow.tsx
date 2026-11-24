import type { Doc } from "@convex/_generated/dataModel";
import { Pencil } from "lucide-react";
import { setCount, setReference } from "#/lib/load";

interface Props {
	set: Doc<"sets">;
	onEdit: (set: Doc<"sets">) => void;
}

export function SetRow({ set, onEdit }: Props) {
	const orm = setReference(set);

	return (
		<tr className="border-b border-border last:border-0 text-sm">
			<td className="py-2 pl-2 pr-3 text-text-muted w-8">{set.setNumber}</td>
			<td className="py-2 pr-3 w-24">
				<span className="text-xs capitalize text-text-muted">
					{set.setType}
				</span>
				{set.notes ? (
					<p className="text-xs text-text-muted break-words">{set.notes}</p>
				) : null}
			</td>
			<td className="py-2 pr-3 w-24">
				{set.weight > 0 ? (
					<>
						<span className="text-text font-medium">{set.weight}</span>
						<span className="text-xs text-text-muted ml-0.5">{set.unit}</span>
					</>
				) : (
					<span className="text-text-muted">BW</span>
				)}
			</td>
			<td className="py-2 pr-3 w-16">
				<span className="text-text">{setCount(set)}</span>
			</td>
			<td className="py-2 pr-3 w-16">
				<span className="text-text-muted">{set.rpe ?? "—"}</span>
			</td>
			<td className="py-2 pr-3 w-24">
				<span className="text-xs text-text-muted">
					{orm
						? `${orm.value} ${orm.kind === "calculated" ? "est." : "actual"}`
						: "—"}
				</span>
			</td>
			<td className="py-2 pr-2 w-10">
				<button
					type="button"
					onClick={() => onEdit(set)}
					className="p-1.5 text-text-muted hover:text-accent-ink transition-colors"
					aria-label={`Edit set ${set.setNumber}`}
				>
					<Pencil size={13} />
				</button>
			</td>
		</tr>
	);
}
