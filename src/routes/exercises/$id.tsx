import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { MuscleMap } from "#/components/exercises/MuscleMap";
import { calculateOneRepMax } from "#/lib/oneRepMax";
import { cn } from "#/lib/utils";

type Tab = "overview" | "progress" | "history";

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
	const [activeTab, setActiveTab] = useState<Tab>("overview");

	const exercise = useQuery(api.exercises.getById, {
		id: id as Id<"exercises">,
	});
	const history =
		useQuery(api.exercises.getHistory, {
			exerciseId: id as Id<"exercises">,
		}) ?? [];
	const currentOrm = useQuery(api.oneRepMaxes.getCurrentForExercise, {
		exerciseId: id as Id<"exercises">,
	});
	const ormHistory =
		useQuery(api.oneRepMaxes.listForExercise, {
			exerciseId: id as Id<"exercises">,
		}) ?? [];

	if (exercise === undefined) {
		return (
			<div className="p-6 text-[var(--text-muted)] text-sm">Loading…</div>
		);
	}
	if (exercise === null) {
		return (
			<div className="p-6 text-red-400 text-sm">Exercise not found.</div>
		);
	}

	const ormChartData = [...ormHistory]
		.sort((a, b) => a.date - b.date)
		.map((r) => ({
			date: format(new Date(r.date), "MMM d"),
			value: r.value,
			source: r.source,
		}));

	const unit = history[0]?.unit ?? currentOrm?.unit ?? "kg";
	const repRangeData = Array.from({ length: 10 }, (_, i) => {
		const reps = i + 1;
		const maxWeight = history
			.filter((s) => s.reps === reps && s.unit === unit)
			.reduce<number | null>(
				(max, s) => (max === null || s.weight > max ? s.weight : max),
				null,
			);
		const theoretical1RM =
			maxWeight !== null ? calculateOneRepMax(maxWeight, reps).value : null;
		return { label: `${reps}RM`, reps, maxWeight, theoretical1RM };
	});
	const hasRepRangeData = repRangeData.some((d) => d.maxWeight !== null);
	// biome-ignore lint/suspicious/noExplicitAny: Recharts formatter type mismatch
	const strengthCurveFormatter: any = (value: number | null, name: string) =>
		value !== null ? [`${value} ${unit}`, name] : [null, name];

	const tabs: { id: Tab; label: string }[] = [
		{ id: "overview", label: "Overview" },
		{ id: "progress", label: "Progress" },
		{ id: "history", label: "History" },
	];

	return (
		<div className="p-4 sm:p-6 max-w-2xl mx-auto pb-20 sm:pb-6">
			<Link
				to="/exercises"
				className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-white mb-4 transition-colors"
			>
				<ArrowLeft size={14} />
				Back to exercises
			</Link>

			{/* Hero card */}
			<div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-5 mb-4 text-center">
				<h1 className="text-2xl font-black text-white tracking-tight mb-2">
					{exercise.name}
				</h1>
				<div className="flex gap-1.5 justify-center mb-4">
					<span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--text-muted)] capitalize">
						{exercise.category}
					</span>
					<span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--text-muted)] capitalize">
						{exercise.equipment}
					</span>
				</div>

				<div className="mb-4">
					<MuscleMap muscleGroups={exercise.muscleGroups} size="sm" />
				</div>

				<div className="flex flex-wrap gap-1.5 justify-center">
					{exercise.muscleGroups.map((mg) => (
						<span
							key={mg}
							className="rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-[var(--accent-dim)] text-[var(--accent)] border border-[rgba(29,185,84,0.2)] capitalize"
						>
							{mg}
						</span>
					))}
				</div>
			</div>

			{/* Tabs */}
			<div className="flex border-b border-[var(--border)] mb-4">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						className={cn(
							"flex-1 py-2.5 text-xs font-semibold transition-colors",
							activeTab === tab.id
								? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
								: "text-[var(--text-muted)] hover:text-white",
						)}
					>
						{tab.label}
					</button>
				))}
			</div>

			{/* Overview tab */}
			{activeTab === "overview" && (
				<div className="flex flex-col gap-3">
					{currentOrm && (
						<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
							<p className="text-[9px] tracking-widest text-[var(--text-muted)] uppercase mb-2">
								Current 1RM
							</p>
							<div className="flex items-baseline gap-1.5 mb-2">
								<span className="text-4xl font-black text-white tracking-tight">
									{currentOrm.value}
								</span>
								<span className="text-sm text-[var(--text-muted)]">
									{currentOrm.unit}
								</span>
							</div>
							<span className="inline-block text-[10px] px-2 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)]">
								{currentOrm.source === "calculated"
									? "estimated"
									: currentOrm.source}
							</span>
						</div>
					)}

					{exercise.notes && (
						<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
							<p className="text-[9px] tracking-widest text-[var(--text-muted)] uppercase mb-2">
								Notes
							</p>
							<p className="text-sm text-[var(--text-muted)] leading-relaxed">
								{exercise.notes}
							</p>
						</div>
					)}

					{!currentOrm && !exercise.notes && (
						<p className="text-sm text-[var(--text-muted)] text-center py-8">
							No data yet. Log sets for this exercise to see your 1RM.
						</p>
					)}
				</div>
			)}

			{/* Progress tab */}
			{activeTab === "progress" && (
				<div className="flex flex-col gap-4">
					<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
						<h2 className="text-sm font-semibold text-white mb-4">
							1RM Progress
						</h2>
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
						<h2 className="text-sm font-semibold text-white mb-1">
							Strength Curve
						</h2>
						<p className="text-xs text-[var(--text-muted)] mb-4">
							Max weight logged vs. theoretical 1RM per rep count
						</p>
						{hasRepRangeData ? (
							<ResponsiveContainer width="100%" height={220}>
								<LineChart data={repRangeData}>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke="rgba(255,255,255,0.06)"
									/>
									<XAxis
										dataKey="label"
										tick={{ fill: "#b3b3b3", fontSize: 11 }}
										axisLine={false}
										tickLine={false}
									/>
									<YAxis
										tick={{ fill: "#b3b3b3", fontSize: 11 }}
										unit={unit}
										axisLine={false}
										tickLine={false}
										width={52}
									/>
									<Tooltip
										contentStyle={{
											background: "var(--surface)",
											border: "1px solid var(--border)",
											borderRadius: 8,
											color: "#fff",
											fontSize: 12,
										}}
										formatter={strengthCurveFormatter}
									/>
									<Legend
										wrapperStyle={{
											fontSize: 11,
											color: "#b3b3b3",
											paddingTop: 8,
										}}
									/>
									<Line
										type="monotone"
										dataKey="maxWeight"
										name="Max weight logged"
										stroke="#1DB954"
										strokeWidth={2}
										dot={{ fill: "#1DB954", r: 4, strokeWidth: 0 }}
										activeDot={{ r: 6, fill: "#1ed760" }}
										connectNulls={false}
									/>
									<Line
										type="monotone"
										dataKey="theoretical1RM"
										name="Theoretical 1RM"
										stroke="#b3b3b3"
										strokeWidth={2}
										strokeDasharray="4 2"
										dot={{ fill: "#b3b3b3", r: 3, strokeWidth: 0 }}
										activeDot={{ r: 5 }}
										connectNulls={false}
									/>
								</LineChart>
							</ResponsiveContainer>
						) : (
							<p className="text-sm text-[var(--text-muted)] py-6 text-center">
								Log sets for this exercise to see the strength curve.
							</p>
						)}
					</div>
				</div>
			)}

			{/* History tab */}
			{activeTab === "history" && (
				<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
					<h2 className="text-sm font-semibold text-white mb-4">
						Set History ({history.length} sets)
					</h2>
					{history.length > 0 ? (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-[var(--border)]">
										{["Date", "Set", "Type", "Weight", "Reps", "RPE", "Est. 1RM"].map(
											(h) => (
												<th
													key={h}
													className="text-left pb-2 text-xs text-[var(--text-muted)] font-medium pr-4 whitespace-nowrap"
												>
													{h}
												</th>
											),
										)}
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
			)}
		</div>
	);
}
