import { createFileRoute } from "@tanstack/react-router";
import { JoinHostedWorkout } from "#/components/hosted/JoinHostedWorkout";

export const Route = createFileRoute("/join/$token")({
	component: JoinHostedWorkoutPage,
});

function JoinHostedWorkoutPage() {
	const { token } = Route.useParams();
	return <JoinHostedWorkout token={token} />;
}
