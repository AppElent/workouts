import { api } from "@convex/_generated/api";
import { timedLookup } from "@foundry/core";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { CreateRoutineForm } from "#/components/routines/CreateRoutineForm";
import { RoutineCard } from "#/components/routines/RoutineCard";
import { useExercises } from "#/lib/exercises";

export const Route = createFileRoute("/_app/_authed/routines/")({
	component: RoutinesPage,
});

function RoutinesPage() {
	const routines = useQuery(api.routines.list) ?? [];
	const exercises = useExercises();
	const isTimed = useMemo(() => timedLookup(exercises), [exercises]);

	return (
		<div className="p-4 sm:p-6 max-w-4xl mx-auto">
			<h1 className="text-2xl font-bold text-text mb-6">Routines</h1>

			{routines.length > 0 ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
					{routines.map((routine) => (
						<RoutineCard
							key={routine._id}
							routine={routine}
							isTimed={isTimed}
						/>
					))}
				</div>
			) : (
				<div className="rounded-xl bg-surface border border-border p-8 text-center mb-8">
					<p className="text-text-muted text-sm">
						No routines yet. Create your first template below.
					</p>
				</div>
			)}

			<CreateRoutineForm />
		</div>
	);
}
