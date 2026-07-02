import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	HostedWorkoutBuilder,
	type HostedWorkoutBuilderInitial,
} from "#/components/hosted/HostedWorkoutBuilder";

export const Route = createFileRoute("/hosted-workouts/edit/$id")({
	component: EditHostedWorkoutGuarded,
});

function EditHostedWorkoutGuarded() {
	return (
		<>
			<SignedIn>
				<EditHostedWorkoutPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

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
			<div className="p-6 text-sm text-red-400">Hosted workout not found.</div>
		);
	}
	if (data.hosted.status !== "draft") {
		return (
			<div className="p-6 text-sm text-[var(--text-muted)]">
				Only draft workouts can be edited.
			</div>
		);
	}

	const { hosted } = data;
	const initial: HostedWorkoutBuilderInitial = {
		title: hosted.title,
		notes: hosted.notes,
		scheduledAt: hosted.scheduledAt,
		hostParticipation: hosted.hostParticipation,
		template: {
			strengthBlocks: hosted.template.strengthBlocks.map((block) => ({
				blockId: block.blockId,
				exerciseName: block.exerciseName,
				instructions: block.instructions,
				defaultSets: block.defaultSets,
				defaultReps: block.defaultReps,
				defaultWeight: block.defaultWeight,
				unit: block.unit,
				percentageOfOneRepMax: block.percentageOfOneRepMax,
			})),
			wodBlocks: hosted.template.wodBlocks.map((block) => ({
				blockId: block.blockId,
				name: block.name,
				type: block.type,
				description: block.description,
				levels: block.levels.map((level) => ({
					level: level.level,
					label: level.label,
					description: level.description,
					movements: level.movements.map((movement) => ({
						name: movement.name,
						reps: movement.reps,
						weight: movement.weight,
						unit: movement.unit,
						notes: movement.notes,
					})),
				})),
			})),
		},
	};

	return (
		<div className="mx-auto max-w-3xl p-4 sm:p-6">
			<h1 className="mb-6 text-2xl font-bold text-white">Edit Workout</h1>
			<HostedWorkoutBuilder
				hostedWorkoutId={id as Id<"hostedWorkouts">}
				initial={initial}
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
