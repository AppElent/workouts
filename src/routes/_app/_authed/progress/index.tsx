import { api } from "@convex/_generated/api";
import { deviceUtcOffsetMinutes } from "@foundry/core";
import type { ExerciseId } from "@foundry/core/exercises";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { BodyMetricsPanel } from "#/components/progress/BodyMetricsPanel";
import { useExercises } from "#/lib/exercises";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/_app/_authed/progress/")({
	component: ProgressPage,
});

type ProgressTab = "exercises" | "body";

function ProgressPage() {
	const exercises = useExercises();
	const [selectedId, setSelectedId] = useState<ExerciseId | "">("");
	const [tab, setTab] = useState<ProgressTab>("exercises");

	const tabs: { id: ProgressTab; label: string }[] = [
		{ id: "exercises", label: "Exercises" },
		{ id: "body", label: "Body" },
	];

	return (
		<div className="p-4 sm:p-6 max-w-4xl mx-auto">
			<h1 className="text-2xl font-bold text-text mb-4">Progress</h1>

			<div className="flex border-b border-border mb-6">
				{tabs.map((t) => (
					<button
						key={t.id}
						type="button"
						onClick={() => setTab(t.id)}
						className={cn(
							"flex-1 sm:flex-none sm:px-6 py-2.5 text-sm font-semibold transition-colors",
							tab === t.id
								? "text-accent-ink border-b-2 border-accent-ink"
								: "text-text-muted hover:text-text",
						)}
					>
						{t.label}
					</button>
				))}
			</div>

			{tab === "exercises" && (
				<>
					<div className="mb-6">
						<select
							value={selectedId}
							onChange={(e) => setSelectedId(e.target.value as ExerciseId)}
							className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text min-w-[240px] w-full sm:w-auto focus:outline-none focus:ring-1 focus:ring-accent-ink"
						>
							<option value="">Select an exercise…</option>
							{exercises.map((ex) => (
								<option key={ex._id} value={ex._id}>
									{ex.name}
								</option>
							))}
						</select>
					</div>

					{selectedId ? (
						<ExerciseCharts exerciseId={selectedId as ExerciseId} />
					) : (
						<div className="rounded-xl bg-surface border border-border p-10 text-center">
							<p className="text-text-muted text-sm">
								Select an exercise to view your progress charts.
							</p>
						</div>
					)}
				</>
			)}

			{tab === "body" && <BodyMetricsPanel />}
		</div>
	);
}

function ExerciseCharts({ exerciseId }: { exerciseId: ExerciseId }) {
	const ormRecords =
		useQuery(api.oneRepMaxes.listForExercise, { exerciseId }) ?? [];
	const volumeData =
		useQuery(api.progress.weeklyVolume, {
			exerciseId,
			utcOffsetMinutes: deviceUtcOffsetMinutes(),
		}) ?? [];

	const ormChartData = [...ormRecords]
		.sort((a, b) => a.date - b.date)
		.map((r) => ({
			date: format(new Date(r.date), "MMM d"),
			value: r.value,
			source: r.source,
		}));

	const tooltipStyle = {
		contentStyle: {
			background: "var(--surface)",
			border: "1px solid var(--border-strong)",
			borderRadius: 8,
			color: "var(--text)",
			fontSize: 12,
		},
	};

	return (
		<div className="flex flex-col gap-6">
			<div className="rounded-xl bg-surface border border-border p-5">
				<h2 className="text-sm font-semibold text-text mb-1">1RM Over Time</h2>
				<p className="text-xs text-text-muted mb-4">
					Actual + estimated (Epley) records
				</p>
				{ormChartData.length > 0 ? (
					<ResponsiveContainer width="100%" height={240}>
						<LineChart data={ormChartData}>
							<CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" />
							<XAxis
								dataKey="date"
								tick={{ fill: "var(--text-muted)", fontSize: 11 }}
								axisLine={false}
								tickLine={false}
							/>
							<YAxis
								tick={{ fill: "var(--text-muted)", fontSize: 11 }}
								unit="kg"
								axisLine={false}
								tickLine={false}
								width={48}
							/>
							<Tooltip
								{...tooltipStyle}
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
								stroke="var(--accent-ink)"
								strokeWidth={2}
								dot={{ fill: "var(--accent-ink)", r: 4, strokeWidth: 0 }}
								activeDot={{ r: 6, fill: "var(--accent-ink)" }}
							/>
						</LineChart>
					</ResponsiveContainer>
				) : (
					<p className="text-sm text-text-muted py-8 text-center">
						No 1RM data yet. Log some sets!
					</p>
				)}
			</div>

			<div className="rounded-xl bg-surface border border-border p-5">
				<h2 className="text-sm font-semibold text-text mb-1">Weekly Volume</h2>
				<p className="text-xs text-text-muted mb-4">
					Kg lifted per week (weight × reps), warm-ups excluded
				</p>
				{volumeData.length > 0 ? (
					<ResponsiveContainer width="100%" height={200}>
						<BarChart data={volumeData}>
							<CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" />
							<XAxis
								dataKey="week"
								tick={{ fill: "var(--text-muted)", fontSize: 10 }}
								axisLine={false}
								tickLine={false}
							/>
							<YAxis
								tick={{ fill: "var(--text-muted)", fontSize: 11 }}
								unit="kg"
								axisLine={false}
								tickLine={false}
								width={52}
							/>
							<Tooltip
								{...tooltipStyle}
								formatter={
									((value: number | undefined) => [
										`${value ?? ""} kg`,
										"Volume",
										// biome-ignore lint/suspicious/noExplicitAny: Recharts formatter type mismatch
									]) as any
								}
							/>
							<Bar
								dataKey="volume"
								fill="var(--accent-ink)"
								radius={[4, 4, 0, 0]}
								maxBarSize={40}
							/>
						</BarChart>
					</ResponsiveContainer>
				) : (
					<p className="text-sm text-text-muted py-8 text-center">
						No volume data yet.
					</p>
				)}
			</div>
		</div>
	);
}
