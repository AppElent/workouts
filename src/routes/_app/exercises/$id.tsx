import { useAuth } from "@clerk/react";
import { api } from "@convex/_generated/api";
import {
	calculateOneRepMax,
	exerciseRecords,
	isTimedExercise,
	plural,
	type StrengthReferenceSource,
} from "@foundry/core";
import type { ExerciseId } from "@foundry/core/exercises";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
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
import { PersonalRecords } from "#/components/exercises/PersonalRecords";
import { useExercise } from "#/lib/exercises";
import { fmt, useI18n, useMessages } from "#/lib/i18n";
import { formatShortDate } from "#/lib/i18n/format";
import {
	displayLoad,
	longestHold,
	overviewHint,
	setCount,
	setReference,
} from "#/lib/load";
import { cn } from "#/lib/utils";

type Tab = "overview" | "progress" | "history";

const REP_RANGE = Array.from({ length: 10 }, (_, i) => i + 1);

export const Route = createFileRoute("/_app/exercises/$id")({
	component: ExerciseDetailPage,
});

function SignInPrompt({ message }: { message: string }) {
	const t = useMessages().exercise;
	return (
		<div className="rounded-xl bg-surface border border-border p-6 flex flex-col items-center gap-3 text-center">
			<p className="text-sm text-text-muted">{message}</p>
			<Link
				to="/sign-in"
				className="rounded-full bg-accent-fill px-5 py-2 text-sm font-bold text-on-accent hover:bg-accent-pressed transition-colors"
			>
				{t.signIn}
			</Link>
		</div>
	);
}

function ExerciseDetailPage() {
	const { id } = Route.useParams();
	const [activeTab, setActiveTab] = useState<Tab>("overview");
	const { locale, messages } = useI18n();
	const t = messages.exercise;

	const { isSignedIn } = useAuth();
	const signedIn = Boolean(isSignedIn);

	const exercise = useExercise(id);
	const history =
		useQuery(
			api.exercises.getHistory,
			signedIn ? { exerciseId: id as ExerciseId } : "skip",
		) ?? [];
	const currentOrm = useQuery(
		api.oneRepMaxes.getCurrentForExercise,
		signedIn ? { exerciseId: id as ExerciseId } : "skip",
	);
	const ormHistory =
		useQuery(
			api.oneRepMaxes.listForExercise,
			signedIn ? { exerciseId: id as ExerciseId } : "skip",
		) ?? [];

	if (exercise === undefined) {
		return <div className="p-6 text-text-muted text-sm">{t.loading}</div>;
	}
	if (exercise === null) {
		return <div className="p-6 text-danger text-sm">{t.notFound}</div>;
	}

	const ormChartData = [...ormHistory]
		.sort((a, b) => a.date - b.date)
		.map((r) => ({
			date: formatShortDate(locale, r.date),
			value: r.value,
			source: r.source,
		}));

	const unit = history[0]?.unit ?? currentOrm?.unit ?? "kg";
	const repMaxes = exerciseRecords(history, exercise, REP_RANGE).repMaxes;
	const repRangeData = REP_RANGE.map((reps) => {
		const best = repMaxes.find((r) => r.reps === reps);
		const maxWeight = best ? displayLoad(best.valueKg, unit) : null;
		const theoretical1RM =
			maxWeight !== null ? calculateOneRepMax(maxWeight, reps).value : null;
		return { label: `${reps}RM`, reps, maxWeight, theoretical1RM };
	});
	const hasRepRangeData = repMaxes.length > 0;
	// biome-ignore lint/suspicious/noExplicitAny: Recharts formatter type mismatch
	const strengthCurveFormatter: any = (value: number | null, name: string) =>
		value !== null ? [`${value} ${unit}`, name] : [null, name];

	const timed = isTimedExercise(exercise);
	const hint = overviewHint(timed, {
		signedIn,
		hasSets: history.length > 0,
		hasOneRepMax: Boolean(currentOrm),
	});

	// A hold has no 1RM, so it has no 1RM progress or strength curve.
	const tabs: { id: Tab; label: string }[] = [
		{ id: "overview", label: t.tabs.overview },
		...(timed ? [] : [{ id: "progress" as const, label: t.tabs.progress }]),
		{ id: "history", label: t.tabs.history },
	];
	const longest = timed ? longestHold(history) : null;

	return (
		<div className="p-4 sm:p-6 max-w-2xl mx-auto pb-20 sm:pb-6">
			<Link
				to="/exercises"
				className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text mb-4 transition-colors"
			>
				<ArrowLeft size={14} />
				{t.back}
			</Link>

			<div className="rounded-2xl bg-surface border border-border p-5 mb-4 text-center">
				<h1 className="text-2xl font-black text-text tracking-tight mb-2">
					{exercise.name}
				</h1>
				<div className="flex gap-1.5 justify-center mb-4">
					<span className="text-micro px-2 py-0.5 rounded-md bg-surface-2 text-text-muted capitalize">
						{t.category[exercise.category]}
					</span>
					<span className="text-micro px-2 py-0.5 rounded-md bg-surface-2 text-text-muted capitalize">
						{t.equipment[exercise.equipment]}
					</span>
				</div>

				<div className="mb-4">
					<MuscleMap muscleGroups={exercise.muscleGroups} size="sm" />
				</div>

				<div className="flex flex-wrap gap-1.5 justify-center">
					{exercise.muscleGroups.map((mg) => (
						<span
							key={mg}
							className="rounded-full px-2.5 py-0.5 text-eyebrow font-medium bg-accent-dim text-accent-ink border border-accent-ink/20 capitalize"
						>
							{mg}
						</span>
					))}
				</div>
			</div>

			<div className="flex border-b border-border mb-4">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						className={cn(
							"flex-1 py-2.5 text-xs font-semibold transition-colors",
							activeTab === tab.id
								? "text-accent-ink border-b-2 border-accent-ink"
								: "text-text-muted hover:text-text",
						)}
					>
						{tab.label}
					</button>
				))}
			</div>

			{activeTab === "overview" && (
				<div className="flex flex-col gap-3">
					{currentOrm && !timed && (
						<div className="rounded-xl bg-surface border border-border p-4">
							<p className="text-micro tracking-widest text-text-muted uppercase mb-2">
								{t.overview.currentOrm}
							</p>
							<div className="flex items-baseline gap-1.5 mb-2">
								<span className="text-4xl font-black text-text tracking-tight">
									{currentOrm.value}
								</span>
								<span className="text-sm text-text-muted">
									{currentOrm.unit}
								</span>
							</div>
							<span className="inline-block text-micro px-2 py-0.5 rounded bg-accent-dim text-accent-ink">
								{t.overview.source[currentOrm.source]}
							</span>
						</div>
					)}

					{longest && (
						<div className="rounded-xl bg-surface border border-border p-4">
							<p className="text-micro tracking-widest text-text-muted uppercase mb-2">
								{t.overview.longestHold}
							</p>
							<div className="flex items-baseline gap-1.5">
								<span className="text-4xl font-black text-text tracking-tight tabular-nums">
									{longest.reps}
								</span>
								<span className="text-sm text-text-muted">
									{t.overview.secondsUnit}
								</span>
								{longest.weight > 0 && (
									<span className="text-sm text-text-muted">
										+{longest.weight} {longest.unit}
									</span>
								)}
							</div>
						</div>
					)}

					{signedIn && history.length > 0 && !timed && (
						<PersonalRecords
							history={history}
							exercise={exercise}
							unit={unit}
						/>
					)}

					{exercise.notes && (
						<div className="rounded-xl bg-surface border border-border p-4">
							<p className="text-micro tracking-widest text-text-muted uppercase mb-2">
								{t.overview.notes}
							</p>
							<p className="text-sm text-text-muted leading-relaxed">
								{exercise.notes}
							</p>
						</div>
					)}

					{!exercise.notes &&
						hint !== null &&
						(signedIn ? (
							<p className="text-sm text-text-muted text-center py-8">
								{t.overview.hint[hint]}
							</p>
						) : (
							<SignInPrompt message={t.overview.hint[hint]} />
						))}
				</div>
			)}

			{activeTab === "progress" && signedIn && !timed && (
				<div className="flex flex-col gap-4">
					<div className="rounded-xl bg-surface border border-border p-5">
						<h2 className="text-sm font-semibold text-text mb-4">
							{t.progress.ormTitle}
						</h2>
						{ormChartData.length > 1 ? (
							<ResponsiveContainer width="100%" height={220}>
								<LineChart data={ormChartData}>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke="var(--separator)"
									/>
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
										contentStyle={{
											background: "var(--surface)",
											border: "1px solid var(--border)",
											borderRadius: 8,
											color: "var(--text)",
											fontSize: 12,
										}}
										formatter={
											((
												value: number | undefined,
												_: string,
												entry: { payload: { source: string } },
											) => [
												fmt(t.progress.ormTooltip, {
													value: value ?? "",
													source:
														t.overview.source[
															entry.payload.source as StrengthReferenceSource
														],
												}),
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
							<p className="text-sm text-text-muted py-6 text-center">
								{t.progress.ormEmpty}
							</p>
						)}
					</div>

					<div className="rounded-xl bg-surface border border-border p-5">
						<h2 className="text-sm font-semibold text-text mb-1">
							{t.progress.curveTitle}
						</h2>
						<p className="text-xs text-text-muted mb-4">
							{t.progress.curveNote}
						</p>
						{hasRepRangeData ? (
							<ResponsiveContainer width="100%" height={220}>
								<LineChart data={repRangeData}>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke="var(--separator)"
									/>
									<XAxis
										dataKey="label"
										tick={{ fill: "var(--text-muted)", fontSize: 11 }}
										axisLine={false}
										tickLine={false}
									/>
									<YAxis
										tick={{ fill: "var(--text-muted)", fontSize: 11 }}
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
											color: "var(--text)",
											fontSize: 12,
										}}
										formatter={strengthCurveFormatter}
									/>
									<Legend
										wrapperStyle={{
											fontSize: 11,
											color: "var(--text-muted)",
											paddingTop: 8,
										}}
									/>
									<Line
										type="monotone"
										dataKey="maxWeight"
										name={t.progress.maxWeight}
										stroke="var(--accent-ink)"
										strokeWidth={2}
										dot={{ fill: "var(--accent-ink)", r: 4, strokeWidth: 0 }}
										activeDot={{ r: 6, fill: "var(--accent-ink)" }}
										connectNulls={false}
									/>
									<Line
										type="monotone"
										dataKey="theoretical1RM"
										name={t.progress.theoreticalOrm}
										stroke="var(--text-muted)"
										strokeWidth={2}
										strokeDasharray="4 2"
										dot={{ fill: "var(--text-muted)", r: 3, strokeWidth: 0 }}
										activeDot={{ r: 5 }}
										connectNulls={false}
									/>
								</LineChart>
							</ResponsiveContainer>
						) : (
							<p className="text-sm text-text-muted py-6 text-center">
								{t.progress.curveEmpty}
							</p>
						)}
					</div>
				</div>
			)}

			{activeTab === "progress" && !signedIn && !timed && (
				<SignInPrompt message={t.progress.signIn} />
			)}

			{activeTab === "history" && signedIn && (
				<div className="rounded-xl bg-surface border border-border p-5">
					<h2 className="text-sm font-semibold text-text mb-4">
						{plural(locale, history.length, t.history.title)}
					</h2>
					{history.length > 0 ? (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-border">
										{[
											t.history.date,
											t.history.set,
											t.history.type,
											timed ? t.history.addedLoad : t.history.weight,
											timed ? t.history.seconds : t.history.reps,
											t.history.rpe,
											...(timed ? [] : [t.history.estimate]),
										].map((h) => (
											<th
												key={h}
												className="text-left pb-2 text-xs text-text-muted font-medium pr-4 whitespace-nowrap"
											>
												{h}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{[...history].reverse().map((set) => {
										const orm = setReference(set);
										return (
											<tr
												key={set._id}
												className="border-b border-border last:border-0"
											>
												<td className="py-2 pr-4 text-text-muted whitespace-nowrap">
													{formatShortDate(locale, set.sessionDate)}
												</td>
												<td className="py-2 pr-4 text-text">
													#{set.setNumber}
													{set.notes ? (
														<p className="max-w-48 text-xs text-text-muted whitespace-pre-wrap break-words">
															{set.notes}
														</p>
													) : null}
												</td>
												<td className="py-2 pr-4 text-text-muted">
													{t.history.setType[set.setType]}
												</td>
												<td className="py-2 pr-4 text-text font-medium">
													{set.weight > 0 ? (
														<>
															{set.weight}
															<span className="text-text-muted text-xs ml-0.5">
																{set.unit}
															</span>
														</>
													) : (
														<span className="text-text-muted">
															{timed ? "—" : t.history.bodyweight}
														</span>
													)}
												</td>
												<td className="py-2 pr-4 text-text">
													{setCount(set, timed)}
												</td>
												<td className="py-2 pr-4 text-text-muted">
													{set.rpe ?? "—"}
												</td>
												{timed ? null : (
													<td className="py-2 text-text-muted text-xs">
														{orm ? orm.value : "—"}
														{orm?.kind === "calculated" && (
															<span className="ml-0.5 text-micro">
																{t.history.estimated}
															</span>
														)}
													</td>
												)}
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					) : (
						<p className="text-sm text-text-muted">{t.history.empty}</p>
					)}
				</div>
			)}

			{activeTab === "history" && !signedIn && (
				<SignInPrompt message={t.history.signIn} />
			)}
		</div>
	);
}
