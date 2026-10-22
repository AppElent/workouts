import { RedirectToSignIn, Show } from "@clerk/react";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { HostedWorkoutDashboard } from "#/components/hosted/HostedWorkoutDashboard";

export const Route = createFileRoute("/hosted-workouts/$id")({
	component: HostedWorkoutDashboardGuarded,
});

function HostedWorkoutDashboardGuarded() {
	const { id } = Route.useParams();

	return (
		<>
			<Show when="signed-in">
				<HostedWorkoutDashboard id={id as Id<"hostedWorkouts">} />
			</Show>
			<Show when="signed-out">
				<RedirectToSignIn />
			</Show>
		</>
	);
}
