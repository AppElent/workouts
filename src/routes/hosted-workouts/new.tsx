import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HostedWorkoutBuilder } from "#/components/hosted/HostedWorkoutBuilder";

export const Route = createFileRoute("/hosted-workouts/new")({
	component: NewHostedWorkoutGuarded,
});

function NewHostedWorkoutGuarded() {
	return (
		<>
			<SignedIn>
				<NewHostedWorkoutPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function NewHostedWorkoutPage() {
	const navigate = useNavigate();
	return (
		<div className="mx-auto max-w-3xl p-4 sm:p-6">
			<h1 className="mb-6 text-2xl font-bold text-white">Host Workout</h1>
			<HostedWorkoutBuilder
				onCreated={(id) =>
					void navigate({ to: "/hosted-workouts/$id", params: { id } })
				}
			/>
		</div>
	);
}
