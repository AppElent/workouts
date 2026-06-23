import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

type Unit = "kg" | "lbs";

export function BodyMetricsPanel() {
	const entries = useQuery(api.bodyMetrics.list) ?? [];
	const latest = useQuery(api.bodyMetrics.latest);
	const addEntry = useMutation(api.bodyMetrics.add);
	const removeEntry = useMutation(api.bodyMetrics.remove);

	const [unit, setUnit] = useState<Unit>("kg");
	const [weight, setWeight] = useState("");
	const [bodyFat, setBodyFat] = useState("");
	const [showMore, setShowMore] = useState(false);
	const [chest, setChest] = useState("");
	const [waist, setWaist] = useState("");
	const [arms, setArms] = useState("");
	const [thighs, setThighs] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	function num(s: string): number | undefined {
		const n = Number.parseFloat(s);
		return Number.isFinite(n) ? n : undefined;
	}

	async function handleSave() {
		setError(null);
		const measurements = {
			chest: num(chest),
			waist: num(waist),
			arms: num(arms),
			thighs: num(thighs),
		};
		const hasMeasurements = Object.values(measurements).some(
			(v) => v !== undefined,
		);
		const w = num(weight);
		const bf = num(bodyFat);
		if (w === undefined && bf === undefined && !hasMeasurements) {
			setError("Enter at least one measurement.");
			return;
		}
		setSaving(true);
		try {
			await addEntry({
				unit,
				weight: w,
				bodyFatPct: bf,
				measurements: hasMeasurements ? measurements : undefined,
			});
			setWeight("");
			setBodyFat("");
			setChest("");
			setWaist("");
			setArms("");
			setThighs("");
			setShowMore(false);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to save.");
		} finally {
			setSaving(false);
		}
	}

	const chartData = [...entries]
		.filter((e) => e.weight !== undefined)
		.sort((a, b) => a.date - b.date)
		.map((e) => ({
			date: format(new Date(e.date), "MMM d"),
			weight: e.weight,
		}));

	const inputCls =
		"h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";
	const labelCls =
		"text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1 block";

	return (
		<div className="flex flex-col gap-6">
			{/* Latest snapshot */}
			{latest && (
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<StatCard
						label="Weight"
						value={latest.weight ? `${latest.weight}` : "—"}
						unit={latest.weight ? latest.unit : ""}
					/>
					<StatCard
						label="Body fat"
						value={latest.bodyFatPct ? `${latest.bodyFatPct}` : "—"}
						unit={latest.bodyFatPct ? "%" : ""}
					/>
					<StatCard
						label="Waist"
						value={
							latest.measurements?.waist ? `${latest.measurements.waist}` : "—"
						}
						unit={latest.measurements?.waist ? "cm" : ""}
					/>
					<StatCard
						label="Logged"
						value={format(new Date(latest.date), "MMM d")}
						unit=""
					/>
				</div>
			)}

			{/* Add form */}
			<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-5">
				<h2 className="text-sm font-semibold text-white mb-4">
					Log measurement
				</h2>
				<div className="grid grid-cols-2 gap-3">
					<div className="col-span-2 sm:col-span-1">
						<span className={labelCls}>Weight</span>
						<div className="flex gap-2">
							<input
								type="number"
								inputMode="decimal"
								min="0"
								step="0.1"
								value={weight}
								onChange={(e) => setWeight(e.target.value)}
								placeholder="0"
								className={inputCls}
							/>
							<button
								type="button"
								onClick={() => setUnit((u) => (u === "kg" ? "lbs" : "kg"))}
								className="h-11 px-3 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm font-semibold text-[var(--accent)]"
							>
								{unit}
							</button>
						</div>
					</div>
					<div className="col-span-2 sm:col-span-1">
						<span className={labelCls}>Body fat %</span>
						<input
							type="number"
							inputMode="decimal"
							min="0"
							step="0.1"
							value={bodyFat}
							onChange={(e) => setBodyFat(e.target.value)}
							placeholder="optional"
							className={inputCls}
						/>
					</div>
				</div>

				<button
					type="button"
					onClick={() => setShowMore((s) => !s)}
					className="mt-3 flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-white transition-colors"
				>
					<ChevronDown
						size={14}
						className={`transition-transform ${showMore ? "rotate-180" : ""}`}
					/>
					Circumference (cm)
				</button>

				{showMore && (
					<div className="grid grid-cols-2 gap-3 mt-3">
						{(
							[
								["Chest", chest, setChest],
								["Waist", waist, setWaist],
								["Arms", arms, setArms],
								["Thighs", thighs, setThighs],
							] as const
						).map(([label, val, setter]) => (
							<div key={label}>
								<span className={labelCls}>{label}</span>
								<input
									type="number"
									inputMode="decimal"
									min="0"
									step="0.1"
									value={val}
									onChange={(e) => setter(e.target.value)}
									placeholder="cm"
									className={inputCls}
								/>
							</div>
						))}
					</div>
				)}

				{error && <p className="text-xs text-[var(--danger)] mt-3">{error}</p>}

				<button
					type="button"
					onClick={() => void handleSave()}
					disabled={saving}
					className="mt-4 w-full h-12 rounded-full bg-[var(--accent)] text-black text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
				>
					<Plus size={18} />
					Save
				</button>
			</div>

			{/* Weight trend */}
			<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
				<h2 className="text-sm font-semibold text-white mb-4">Weight trend</h2>
				{chartData.length > 1 ? (
					<ResponsiveContainer width="100%" height={220}>
						<LineChart data={chartData}>
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
								axisLine={false}
								tickLine={false}
								width={40}
								domain={["dataMin - 1", "dataMax + 1"]}
							/>
							<Tooltip
								contentStyle={{
									background: "#1a1a1a",
									border: "1px solid rgba(255,255,255,0.1)",
									borderRadius: 8,
									color: "#fff",
									fontSize: 12,
								}}
							/>
							<Line
								type="monotone"
								dataKey="weight"
								stroke="#1DB954"
								strokeWidth={2}
								dot={{ fill: "#1DB954", r: 3, strokeWidth: 0 }}
								activeDot={{ r: 6, fill: "#1ed760" }}
							/>
						</LineChart>
					</ResponsiveContainer>
				) : (
					<p className="text-sm text-[var(--text-muted)] py-8 text-center">
						Log your weight on at least two days to see the trend.
					</p>
				)}
			</div>

			{/* History */}
			{entries.length > 0 && (
				<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
					<h2 className="text-sm font-semibold text-white mb-3">History</h2>
					<div className="flex flex-col divide-y divide-[var(--border)]">
						{entries.map((e) => (
							<div
								key={e._id}
								className="py-2.5 flex items-center justify-between gap-3"
							>
								<div className="min-w-0">
									<p className="text-sm text-white">
										{e.weight !== undefined && (
											<span className="font-semibold">
												{e.weight} {e.unit}
											</span>
										)}
										{e.bodyFatPct !== undefined && (
											<span className="text-[var(--text-muted)]">
												{e.weight !== undefined ? " · " : ""}
												{e.bodyFatPct}% bf
											</span>
										)}
										{e.measurements?.waist !== undefined && (
											<span className="text-[var(--text-muted)]">
												{" · "}waist {e.measurements.waist}cm
											</span>
										)}
									</p>
									<p className="text-xs text-[var(--text-muted)] mt-0.5">
										{format(new Date(e.date), "EEE, MMM d · h:mm a")}
									</p>
								</div>
								<button
									type="button"
									onClick={() =>
										void removeEntry({ id: e._id as Id<"bodyMetrics"> })
									}
									aria-label="Delete entry"
									className="p-2 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors shrink-0"
								>
									<Trash2 size={15} />
								</button>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function StatCard({
	label,
	value,
	unit,
}: {
	label: string;
	value: string;
	unit: string;
}) {
	return (
		<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3">
			<p className="text-[9px] tracking-widest text-[var(--text-muted)] uppercase mb-1">
				{label}
			</p>
			<p className="text-lg font-bold text-white tabular-nums">
				{value}
				{unit && (
					<span className="text-xs text-[var(--text-muted)] ml-0.5">
						{unit}
					</span>
				)}
			</p>
		</div>
	);
}
