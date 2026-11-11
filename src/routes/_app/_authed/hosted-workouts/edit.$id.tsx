import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { HostedWorkoutBuilder } from "#/components/hosted/HostedWorkoutBuilder";

export const Route = createFileRoute("/_app/_authed/hosted-workouts/edit/$id")({
	component: EditHostedWorkoutPage,
});

function EditHostedWorkoutPage() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const data = useQuery(api.hostedWorkouts.getMine, {
		id: id as Id<"hostedWorkouts">,
	});

	if (data === undefined) {
		return <div className="p-6 text-sm text-[var(--text-muted)]">Loading…</div>;
	}
	if (data === null) {
		return (
			<div className="p-6 text-sm text-[var(--danger)]">
				Hosted workout not found.
			</div>
		);
	}
	if (data.hosted.status !== "draft") {
		return (
			<div className="p-6 text-sm text-[var(--text-muted)]">
				Only draft workouts can be edited.
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-3xl p-4 sm:p-6">
			<h1 className="mb-6 text-2xl font-bold text-white">Edit Workout</h1>
			<HostedWorkoutBuilder
				hostedWorkoutId={id as Id<"hostedWorkouts">}
				initial={data.hosted}
				onSaved={(savedId) =>
					void navigate({
						to: "/hosted-workouts/$id",
						params: { id: savedId },
					})
				}
			/>
		</div>
	);
}
