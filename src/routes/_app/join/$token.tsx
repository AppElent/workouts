import { HOSTED_WORKOUTS_ENABLED } from "@foundry/core/features";
import { createFileRoute } from "@tanstack/react-router";
import { HostedWorkoutsPaused } from "#/components/hosted/HostedWorkoutsPaused";
import { JoinHostedWorkout } from "#/components/hosted/JoinHostedWorkout";

export const Route = createFileRoute("/_app/join/$token")({
	component: HOSTED_WORKOUTS_ENABLED
		? JoinHostedWorkoutPage
		: HostedWorkoutsPaused,
});

function JoinHostedWorkoutPage() {
	const { token } = Route.useParams();
	return <JoinHostedWorkout token={token} />;
}
