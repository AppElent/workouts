import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { HostedWorkoutDashboard } from "#/components/hosted/HostedWorkoutDashboard";

export const Route = createFileRoute("/_app/_authed/hosted-workouts/$id")({
	component: HostedWorkoutPage,
});

function HostedWorkoutPage() {
	const { id } = Route.useParams();
	return <HostedWorkoutDashboard id={id as Id<"hostedWorkouts">} />;
}
