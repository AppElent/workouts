import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { LogWodResultForm } from "#/components/wods/LogWodResultForm";
import { WodResultHistory } from "#/components/wods/WodResultHistory";

export const Route = createFileRoute("/wods/$id")({
	component: WodDetailGuarded,
});

function WodDetailGuarded() {
	return (
		<>
			<SignedIn>
				<WodDetailPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function WodDetailPage() {
	const { id } = Route.useParams();
	const wodId = id as Id<"wods">;
	const wod = useQuery(api.wods.getById, { id: wodId });
	const results = useQuery(api.wodResults.listForWod, { wodId }) ?? [];

	if (wod === undefined) {
		return <div className="p-6 text-[var(--text-muted)] text-sm">Loading…</div>;
	}
	if (wod === null) {
		return <div className="p-6 text-red-400 text-sm">WOD not found.</div>;
	}

	return (
		<div className="p-4 sm:p-6 max-w-3xl mx-auto flex flex-col gap-6">
			<div>
				<Link
					to="/wods"
					className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-white transition-colors mb-3"
				>
					<ArrowLeft size={13} />
					WODs
				</Link>
				<h1 className="text-2xl font-bold text-white">{wod.name}</h1>
				{wod.repScheme && (
					<p className="text-sm text-[var(--accent)] mt-1">{wod.repScheme}</p>
				)}
				{wod.description && (
					<p className="text-sm text-[var(--text-muted)] mt-2">
						{wod.description}
					</p>
				)}
				<ul className="mt-3 flex flex-col gap-1">
					{wod.movements.map((m) => (
						<li
							key={`${m.name}-${m.reps ?? ""}-${m.weight ?? ""}-${m.distance ?? ""}-${m.notes ?? ""}`}
							className="text-sm text-white"
						>
							{m.reps ? `${m.reps} ` : ""}
							{m.name}
							{m.weight ? ` @ ${m.weight}${m.unit ?? "kg"}` : ""}
							{m.distance ? ` ${m.distance}${m.distanceUnit ?? ""}` : ""}
						</li>
					))}
				</ul>
			</div>

			<LogWodResultForm wodId={wodId} type={wod.type} />

			<div>
				<h2 className="text-sm font-semibold text-white mb-3">History</h2>
				<WodResultHistory type={wod.type} results={results} />
			</div>
		</div>
	);
}
