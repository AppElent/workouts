import type { Doc } from "@convex/_generated/dataModel";
import { format } from "date-fns";
import { Trophy } from "lucide-react";
import {
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	bestScore,
	formatScore,
	prImprovement,
	scoreRank,
} from "#/lib/wodScore";

interface Props {
	type: Doc<"wods">["type"];
	results: Doc<"wodResults">[];
}

export function WodResultHistory({ type, results }: Props) {
	if (results.length === 0) {
		return (
			<p className="text-sm text-[var(--text-muted)]">
				No results yet. Log your first result above.
			</p>
		);
	}

	const best = bestScore(type, results);
	const chartData = results.map((r) => ({
		date: format(new Date(r.date), "MMM d"),
		rank: scoreRank(type, r),
	}));

	// Walk results oldest→newest, marking each new personal best and how much
	// it improved on the previous best.
	const prInfo = new Map<string, { improvement: string | null }>();
	const chronological = [...results].sort((a, b) => a.date - b.date);
	let prevBest: Doc<"wodResults"> | null = null;
	for (const r of chronological) {
		if (!prevBest) {
			prInfo.set(r._id, { improvement: null });
			prevBest = r;
			continue;
		}
		if (scoreRank(type, r) > scoreRank(type, prevBest)) {
			prInfo.set(r._id, { improvement: prImprovement(type, r, prevBest) });
			prevBest = r;
		}
	}

	return (
		<div className="flex flex-col gap-4">
			{best && (
				<div className="flex items-center justify-between rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)]/20 px-4 py-3">
					<div className="flex items-center gap-2">
						<Trophy size={16} className="text-[var(--accent)]" />
						<span className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wide">
							Personal best
						</span>
					</div>
					<span className="text-lg font-bold text-white tabular-nums">
						{formatScore(type, best)}
						<span className="text-[10px] uppercase text-[var(--text-muted)] ml-1.5">
							{best.rxScaled}
						</span>
					</span>
				</div>
			)}
			<div className="h-48 w-full">
				<ResponsiveContainer width="100%" height="100%">
					<LineChart data={chartData}>
						<XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
						<YAxis stroke="var(--text-muted)" fontSize={11} width={36} />
						<Tooltip
							contentStyle={{
								background: "var(--surface)",
								border: "1px solid var(--border)",
								borderRadius: 8,
								fontSize: 12,
							}}
						/>
						<Line
							type="monotone"
							dataKey="rank"
							stroke="var(--accent)"
							strokeWidth={2}
							dot={{ r: 3 }}
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>

			<div className="flex flex-col gap-2">
				{[...results]
					.sort((a, b) => b.date - a.date)
					.map((r) => {
						const pr = prInfo.get(r._id);
						return (
							<div
								key={r._id}
								className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-4 py-2.5"
							>
								<div className="flex items-center gap-2 flex-wrap">
									<span className="text-sm font-semibold text-white tabular-nums">
										{formatScore(type, r)}
									</span>
									<span className="text-[10px] uppercase text-[var(--text-muted)]">
										{r.rxScaled}
									</span>
									{best && r._id === best._id && (
										<Trophy size={13} className="text-[var(--accent)]" />
									)}
									{pr && (
										<span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)] bg-[var(--accent-dim)] border border-[var(--accent)]/30 rounded px-1.5 py-0.5">
											PR{pr.improvement ? ` ${pr.improvement}` : ""}
										</span>
									)}
								</div>
								<span className="text-xs text-[var(--text-muted)]">
									{format(new Date(r.date), "MMM d, yyyy")}
								</span>
							</div>
						);
					})}
			</div>
		</div>
	);
}
