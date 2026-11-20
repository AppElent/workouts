import { api } from "@convex/_generated/api";
import { HOSTED_WORKOUTS_ENABLED } from "@foundry/core/features";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { HostedWorkoutsPaused } from "#/components/hosted/HostedWorkoutsPaused";

export const Route = createFileRoute("/_app/_authed/hosted-workouts/")({
	component: HOSTED_WORKOUTS_ENABLED
		? HostedWorkoutsPage
		: HostedWorkoutsPaused,
});

function HostedWorkoutsPage() {
	const hosted = useQuery(api.hostedWorkouts.listMine) ?? [];
	return (
		<div className="mx-auto max-w-3xl p-4 sm:p-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold text-text">Hosted Workouts</h1>
				<Link
					to="/hosted-workouts/new"
					className="flex items-center gap-2 rounded-lg bg-accent-fill px-4 py-2 text-sm font-bold text-on-accent"
				>
					<Plus size={15} /> Host
				</Link>
			</div>
			<div className="space-y-3">
				{hosted.map((item) => (
					<Link
						key={item._id}
						to="/hosted-workouts/$id"
						params={{ id: item._id }}
						className="block rounded-xl border border-border bg-surface p-4"
					>
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="font-semibold text-text">{item.title}</p>
								<p className="mt-1 text-xs text-text-muted">
									{item.scheduledAt
										? format(new Date(item.scheduledAt), "MMM d, h:mm a")
										: "No scheduled time"}
								</p>
							</div>
							<span className="rounded-full border border-border px-2 py-1 text-xs uppercase text-text-muted">
								{item.status}
							</span>
						</div>
					</Link>
				))}
			</div>
		</div>
	);
}
