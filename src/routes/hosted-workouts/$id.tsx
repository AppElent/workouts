import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
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
			<SignedIn>
				<HostedWorkoutDashboard id={id as Id<"hostedWorkouts">} />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}
