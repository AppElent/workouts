import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HostedWorkoutBuilder } from "#/components/hosted/HostedWorkoutBuilder";

export const Route = createFileRoute("/_app/_authed/hosted-workouts/new")({
	component: NewHostedWorkoutPage,
});

function NewHostedWorkoutPage() {
	const navigate = useNavigate();
	return (
		<div className="mx-auto max-w-3xl p-4 sm:p-6">
			<h1 className="mb-6 text-2xl font-bold text-white">Host Workout</h1>
			<HostedWorkoutBuilder
				onSaved={(id) =>
					void navigate({ to: "/hosted-workouts/$id", params: { id } })
				}
			/>
		</div>
	);
}
