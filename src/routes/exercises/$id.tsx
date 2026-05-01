import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { calculateOneRepMax } from "#/lib/oneRepMax";

export const Route = createFileRoute("/exercises/$id")({
	component: ExerciseDetailPageGuarded,
});

function ExerciseDetailPageGuarded() {
	return (
		<>
			<SignedIn>
				<ExerciseDetailPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function ExerciseDetailPage() {
	const { id } = Route.useParams();
	const exercise = useQuery(api.exercises.getById, {
		id: id as Id<"exercises">,
	});
	const history =
		useQuery(api.exercises.getHistory, { exerciseId: id as Id<"exercises"> }) ??
		[];
	const currentOrm = useQuery(api.oneRepMaxes.getCurrentForExercise, {
		exerciseId: id as Id<"exercises">,
	});
	const ormHistory =
		useQuery(api.oneRepMaxes.listForExercise, {
			exerciseId: id as Id<"exercises">,
		}) ?? [];

	if (exercise === undefined) {
		return <div className="p-6 text-[var(--text-muted)] text-sm">Loading…</div>;
	}
	if (exercise === null) {
		return <div className="p-6 text-red-400 text-sm">Exercise not found.</div>;
	}

	const ormChartData = [...ormHistory]
		.sort((a, b) => a.date - b.date)
		.map((r) => ({
			date: format(new Date(r.date), "MMM d"),
			value: r.value,
			source: r.source,
		}));

	return (
		<div className="p-4 sm:p-6 max-w-3xl mx-auto">
			<Link
				to="/exercises"
				className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-white mb-5 transition-colors"
			>
				<ArrowLeft size={14} />
				Back to exercises
			</Link>

			<div className="mb-6">
				<h1 className="text-2xl font-bold text-white">{exercise.name}</h1>
				<div className="flex flex-wrap gap-2 mt-2">
					<span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-[var(--text-muted)] capitalize">
						{exercise.category}
					</span>
					<span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-[var(--text-muted)] capitalize">
						{exercise.equipment}
					</span>
					{exercise.muscleGroups.map((mg) => (
						<span
							key={mg}
							className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-dim)] text-[var(--accent)] capitalize"
						>
							{mg}
						</span>
					))}
				</div>
				{exercise.notes && (
					<p className="mt-3 text-sm text-[var(--text-muted)]">
						{exercise.notes}
					</p>
				)}
			</div>

			{currentOrm && (
				<div className="mb-6 rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 flex items-center justify-between">
					<div>
						<p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
							Current 1RM
						</p>
						<p className="text-3xl font-black text-white">
							{currentOrm.value}
							<span className="text-sm font-medium text-[var(--text-muted)] ml-1">
								{currentOrm.unit}
							</span>
						</p>
					</div>
					<span className="text-xs px-2 py-1 rounded-full bg-[var(--accent-dim)] text-[var(--accent)] capitalize font-medium">
						{currentOrm.source === "calculated"
							? "estimated"
							: currentOrm.source}
					</span>
				</div>
			)}

			<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 mb-6">
				<h2 className="text-sm font-semibold text-white mb-4">1RM Progress</h2>
				{ormChartData.length > 1 ? (
					<ResponsiveContainer width="100%" height={220}>
						<LineChart data={ormChartData}>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="rgba(255,255,255,0.06)"
							/>
							<XAxis
								dataKey="date"
								tick={{ fill: "#b3b3b3", fontSize: 11 }}
								axisLine={false}
								tickLine={false}
							/>
							<YAxis
								tick={{ fill: "#b3b3b3", fontSize: 11 }}
								unit="kg"
								axisLine={false}
								tickLine={false}
								width={48}
							/>
							<Tooltip
								contentStyle={{
									background: "var(--surface)",
									border: "1px solid var(--border)",
									borderRadius: 8,
									color: "#fff",
									fontSize: 12,
								}}
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								formatter={
									((
										value: number | undefined,
										_: string,
										entry: { payload: { source: string } },
									) => [
										`${value ?? ""} kg (${entry.payload.source})`,
										"1RM",
										// biome-ignore lint/suspicious/noExplicitAny: Recharts formatter type mismatch
									]) as any
								}
							/>
							<Line
								type="monotone"
								dataKey="value"
								stroke="#1DB954"
								strokeWidth={2}
								dot={{ fill: "#1DB954", r: 4, strokeWidth: 0 }}
								activeDot={{ r: 6, fill: "#1ed760" }}
							/>
						</LineChart>
					</ResponsiveContainer>
				) : (
					<p className="text-sm text-[var(--text-muted)] py-6 text-center">
						Log at least 2 sessions to see the 1RM trend.
					</p>
				)}
			</div>

			<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
				<h2 className="text-sm font-semibold text-white mb-4">
					Set History ({history.length} sets)
				</h2>
				{history.length > 0 ? (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-[var(--border)]">
									{[
										"Date",
										"Set",
										"Type",
										"Weight",
										"Reps",
										"RPE",
										"Est. 1RM",
									].map((h) => (
										<th
											key={h}
											className="text-left pb-2 text-xs text-[var(--text-muted)] font-medium pr-4 whitespace-nowrap"
										>
											{h}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{[...history].reverse().map((set) => {
									const orm = calculateOneRepMax(set.weight, set.reps);
									return (
										<tr
											key={set._id}
											className="border-b border-[var(--border)] last:border-0"
										>
											<td className="py-2 pr-4 text-[var(--text-muted)] whitespace-nowrap">
												{format(new Date(set.sessionDate), "MMM d")}
											</td>
											<td className="py-2 pr-4 text-white">#{set.setNumber}</td>
											<td className="py-2 pr-4 text-[var(--text-muted)] capitalize">
												{set.setType}
											</td>
											<td className="py-2 pr-4 text-white font-medium">
												{set.weight}
												<span className="text-[var(--text-muted)] text-xs ml-0.5">
													{set.unit}
												</span>
											</td>
											<td className="py-2 pr-4 text-white">{set.reps}</td>
											<td className="py-2 pr-4 text-[var(--text-muted)]">
												{set.rpe ?? "—"}
											</td>
											<td className="py-2 text-[var(--text-muted)] text-xs">
												{orm.value}
												{orm.source === "calculated" && (
													<span className="ml-0.5 text-[10px]">est.</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				) : (
					<p className="text-sm text-[var(--text-muted)]">
						No sets logged for this exercise yet.
					</p>
				)}
			</div>
		</div>
	);
}
