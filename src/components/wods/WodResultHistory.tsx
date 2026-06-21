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
import { bestScore, formatScore, scoreRank } from "#/lib/wodScore";

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

	return (
		<div className="flex flex-col gap-4">
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
					.map((r) => (
						<div
							key={r._id}
							className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-4 py-2.5"
						>
							<div className="flex items-center gap-2">
								<span className="text-sm font-semibold text-white tabular-nums">
									{formatScore(type, r)}
								</span>
								<span className="text-[10px] uppercase text-[var(--text-muted)]">
									{r.rxScaled}
								</span>
								{best && r._id === best._id && (
									<Trophy size={13} className="text-[var(--accent)]" />
								)}
							</div>
							<span className="text-xs text-[var(--text-muted)]">
								{format(new Date(r.date), "MMM d, yyyy")}
							</span>
						</div>
					))}
			</div>
		</div>
	);
}
