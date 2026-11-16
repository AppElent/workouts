import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { formatScore } from "@foundry/core";
import { useQuery } from "convex/react";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { LogWodResultForm } from "#/components/wods/LogWodResultForm";

export function SessionWods({
	sessionId,
}: {
	sessionId: Id<"workoutSessions">;
}) {
	const wods = useQuery(api.wods.list) ?? [];
	const results = useQuery(api.wodResults.listForSession, { sessionId }) ?? [];
	const [picking, setPicking] = useState(false);
	const [selectedId, setSelectedId] = useState<Id<"wods"> | null>(null);

	const wodMap = new Map(wods.map((w) => [w._id as string, w]));
	const selected = selectedId ? wodMap.get(selectedId as string) : null;

	return (
		<div className="mt-4 flex flex-col gap-3">
			{results.map((r) => {
				const wod = wodMap.get(r.wodId as string);
				if (!wod) return null;
				return (
					<div
						key={r._id}
						className="flex items-center justify-between rounded-xl bg-surface border border-border px-4 py-3"
					>
						<span className="text-sm font-semibold text-text">{wod.name}</span>
						<span className="text-sm text-accent-ink tabular-nums">
							{formatScore(wod.type, r)}
						</span>
					</div>
				);
			})}

			{selected ? (
				<div className="relative">
					<button
						type="button"
						onClick={() => setSelectedId(null)}
						className="absolute right-3 top-3 z-10 p-1 text-text-muted hover:text-text"
						aria-label="Close WOD form"
					>
						<X size={16} />
					</button>
					<LogWodResultForm
						wodId={selected._id}
						type={selected.type}
						sessionId={sessionId}
						onLogged={() => setSelectedId(null)}
					/>
				</div>
			) : picking ? (
				<div className="rounded-xl border border-border bg-surface divide-y divide-border max-h-64 overflow-y-auto">
					{wods.map((w) => (
						<button
							key={w._id}
							type="button"
							onClick={() => {
								setSelectedId(w._id);
								setPicking(false);
							}}
							className="w-full text-left px-4 py-2.5 text-sm text-text hover:bg-text/5 transition-colors"
						>
							{w.name}
						</button>
					))}
				</div>
			) : (
				<button
					type="button"
					onClick={() => setPicking(true)}
					className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border text-text-muted text-sm hover:border-accent-ink/40 hover:text-accent-ink transition-colors"
				>
					<Plus size={16} />
					Add WOD
				</button>
			)}
		</div>
	);
}
