import type { Id } from "@convex/_generated/dataModel";
import { HOSTED_WORKOUTS_ENABLED } from "@foundry/core/features";
import { createFileRoute } from "@tanstack/react-router";
import { HostedWorkoutDashboard } from "#/components/hosted/HostedWorkoutDashboard";
import { HostedWorkoutsPaused } from "#/components/hosted/HostedWorkoutsPaused";

export const Route = createFileRoute("/_app/_authed/hosted-workouts/$id")({
	component: HOSTED_WORKOUTS_ENABLED ? HostedWorkoutPage : HostedWorkoutsPaused,
});

function HostedWorkoutPage() {
	const { id } = Route.useParams();
	return <HostedWorkoutDashboard id={id as Id<"hostedWorkouts">} />;
}
