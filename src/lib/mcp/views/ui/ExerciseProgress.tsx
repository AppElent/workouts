import { useState } from "react";
import {
	type ExerciseProgressResult,
	PROGRESS_METRICS,
	PROGRESS_RANGES,
	type ProgressMetric,
	type ProgressRange,
} from "../types";
import { BarChart, LineChart } from "./charts";
import type { ViewText } from "./i18n";
import type { ViewProps } from "./ViewRoot";

function Segmented<Value extends string>({
	label,
	options,
	value,
	disabled,
	name,
	onChange,
}: {
	label: string;
	options: readonly { value: Value; label: string }[];
	value: Value;
	disabled: boolean;
	name: string;
	onChange: (value: Value) => void;
}) {
	return (
		<fieldset className="segmented" disabled={disabled}>
			<legend className="visually-hidden">{label}</legend>
			{options.map((option) => (
				<label
					key={option.value}
					data-checked={option.value === value || undefined}
				>
					<input
						type="radio"
						name={name}
						value={option.value}
						checked={option.value === value}
						onChange={() => onChange(option.value)}
					/>
					{option.label}
				</label>
			))}
		</fieldset>
	);
}

function source(text: ViewText, value: string) {
	const sources = text.t.progress.sources;
	return value in sources ? sources[value as keyof typeof sources] : value;
}

export function ExerciseProgress({
	result,
	text,
	reload,
	header,
}: ViewProps<ExerciseProgressResult>) {
	const { t } = text;
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	const load = (unit: number, digits = 1) =>
		`${text.number(unit, digits)} ${result.unit}`;
	const change = async (next: {
		range?: ProgressRange;
		metric?: ProgressMetric;
	}) => {
		setBusy(true);
		setFailed(false);
		try {
			await reload("show_exercise_progress", {
				exerciseId: result.exercise.id,
				range: next.range ?? result.range,
				metric: next.metric ?? result.metric,
			});
		} catch {
			setFailed(true);
		} finally {
			setBusy(false);
		}
	};
	const metricLabel = t.progress[result.metric];
	// Labels carry the year once the range crosses New Year, so 2025-W46 and
	// 2026-W46 stay apart.
	const lastDate =
		result.points.at(-1)?.date ??
		result.weeklyVolume.at(-1)?.week ??
		result.from;
	const spansYears = result.from.slice(0, 4) !== lastDate.slice(0, 4);
	const { summary } = result;
	return (
		<section aria-busy={busy}>
			<header className="toolbar">
				<div>
					<h2>{result.exercise.name}</h2>
					<p className="muted small">
						{text.plural(summary.sessions, t.progress.sessions)}
					</p>
				</div>
				<div className="actions">{header}</div>
			</header>
			<div className="controls">
				<Segmented
					name="metric"
					label={t.progress.metric}
					value={result.metric}
					disabled={busy}
					options={PROGRESS_METRICS.map((value) => ({
						value,
						label: t.progress[value],
					}))}
					onChange={(metric) => void change({ metric })}
				/>
				<Segmented
					name="range"
					label={t.progress.range}
					value={result.range}
					disabled={busy}
					options={PROGRESS_RANGES.map((value) => ({
						value,
						label: t.progress.ranges[value],
					}))}
					onChange={(range) => void change({ range })}
				/>
			</div>
			{failed && (
				<p className="notice danger" role="alert">
					{t.common.error}
				</p>
			)}
			<div className="summary">
				<div className="stat">
					<span className="label">{t.progress.latest}</span>
					<strong>
						{summary.latest === null ? "–" : load(summary.latest)}
					</strong>
				</div>
				<div className="stat">
					<span className="label">{t.progress.best}</span>
					<strong>{summary.best === null ? "–" : load(summary.best)}</strong>
				</div>
				<div className="stat">
					<span className="label">{t.progress.change}</span>
					<strong>
						{summary.change === null
							? "–"
							: `${summary.change > 0 ? "+" : ""}${load(summary.change)}`}
					</strong>
				</div>
			</div>
			<h3>{metricLabel}</h3>
			{result.points.length === 0 ? (
				<p className="muted">{t.progress.noSets}</p>
			) : (
				<LineChart
					label={text.fmt(t.progress.chart, { metric: metricLabel })}
					format={(value) => text.number(value)}
					points={result.points.map((point) => ({
						label: text.day(point.date, spansYears ? "shortYear" : "short"),
						value: point.value,
					}))}
				/>
			)}
			{result.weeklyVolume.length > 0 && (
				<>
					<h3>{t.progress.weeklyVolume}</h3>
					<BarChart
						label={text.fmt(t.progress.volumeChart, { unit: result.unit })}
						format={(value) => text.number(value)}
						points={result.weeklyVolume.map((week) => ({
							label: spansYears ? week.week : week.week.replace(/^\d{4}-/, ""),
							value: week.volume,
						}))}
					/>
				</>
			)}
			<h3>{t.progress.recorded}</h3>
			{result.oneRepMaxes.length === 0 ? (
				<p className="muted">{t.progress.noRecords}</p>
			) : (
				<ul className="records">
					{result.oneRepMaxes
						.slice(-6)
						.reverse()
						.map((record) => (
							<li key={`${record.date}-${record.value}-${record.source}`}>
								<span>{text.day(record.date, "short")}</span>
								<strong>
									{text.number(record.value, 1)} {record.unit}
								</strong>
								<span className="muted small">
									{source(text, record.source)}
								</span>
							</li>
						))}
				</ul>
			)}
		</section>
	);
}
