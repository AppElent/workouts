import { useAuth } from "@clerk/react";
import { Link } from "@tanstack/react-router";
import { PauseCircle } from "lucide-react";
import { Button } from "#/components/ui/button";
import { EmptyState } from "#/components/ui/empty-state";
import { useMessages } from "#/lib/i18n";

/**
 * Shown on every Hosted Workout route and join link while
 * HOSTED_WORKOUTS_ENABLED is false (APP-437). Links signed-in people to their
 * dashboard and everyone else to the landing page.
 */
export function HostedWorkoutsPaused() {
	const { hosted } = useMessages();
	const { isSignedIn } = useAuth();
	return (
		<div className="mx-auto max-w-md p-4 sm:p-6">
			<EmptyState
				icon={PauseCircle}
				title={hosted.paused.title}
				description={hosted.paused.description}
				action={
					<Button
						variant="outline"
						nativeButton={false}
						render={<Link to={isSignedIn ? "/dashboard" : "/"} />}
					>
						{hosted.paused.home}
					</Button>
				}
			/>
		</div>
	);
}
