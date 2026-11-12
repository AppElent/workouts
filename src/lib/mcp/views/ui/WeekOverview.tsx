import { useState } from "react";
import type { MacroGoal, WeekDay, WeekOverviewResult } from "../types";
import type { ViewText } from "./i18n";
import type { ViewProps } from "./ViewRoot";

function goal(goals: readonly MacroGoal[], macro: MacroGoal["macro"]) {
	return goals.find((entry) => entry.macro === macro);
}

function GoalBar({
	value,
	target,
	label,
}: {
	value: number | null;
	target: MacroGoal | undefined;
	label: string;
}) {
	if (value === null || !target) return null;
	const share = Math.min(value / target.target, 1.25);
	const met =
		target.direction === "min"
			? value >= target.target
			: value <= target.target;
	return (
		<div
			className="bar"
			role="img"
			aria-label={label}
			data-state={met ? "met" : "unmet"}
		>
			<span style={{ width: `${(share / 1.25) * 100}%` }} />
			<i style={{ left: `${100 / 1.25}%` }} />
		</div>
	);
}

function minutes(seconds: number, text: ViewText) {
	const total = Math.round(seconds / 60);
	const hours = Math.floor(total / 60);
	const rest = total % 60;
	return hours > 0
		? text.fmt(text.t.units.hours, {
				hours,
				minutes: String(rest).padStart(2, "0"),
			})
		: text.fmt(text.t.units.minutes, { value: total });
}

function Day({ day, text }: { day: WeekDay; text: ViewText }) {
	const { t } = text;
	const energyGoal = goal(day.goals, "energyKcal");
	const proteinGoal = goal(day.goals, "proteinG");
	const kcal = day.nutrition.energyKcal;
	const goalText = (target: MacroGoal | undefined, unit: "kcal" | "grams") =>
		target
			? text.fmt(
					target.direction === "min" ? t.common.goalMin : t.common.goalMax,
					{
						target: text.fmt(t.units[unit], {
							value: text.number(target.target),
						}),
					},
				)
			: "";
	return (
		<li className="day">
			<h3>{text.day(day.date, "weekday")}</h3>
			<ul className="activities">
				{day.activities.length === 0 && (
					<li className="muted">{t.week.rest}</li>
				)}
				{day.activities.map((activity) => (
					<li key={activity.id} className={`chip sport-${activity.sport}`}>
						<strong>{activity.title || t.sports[activity.sport]}</strong>
						<span className="chip-meta">
							{activity.distanceMeters
								? `${text.fmt(t.units.km, { value: text.number(activity.distanceMeters / 1000, 1) })} · `
								: ""}
							{minutes(activity.durationSeconds, text)}
						</span>
					</li>
				))}
			</ul>
			<div className="day-nutrition">
				{kcal === null ? (
					<span className="muted">{t.week.notLogged}</span>
				) : (
					<>
						<span>{text.fmt(t.units.kcal, { value: text.number(kcal) })}</span>
						<GoalBar
							value={kcal}
							target={energyGoal}
							label={`${t.macros.energyKcal}: ${goalText(energyGoal, "kcal")}`}
						/>
						{day.nutrition.proteinG !== null && (
							<span className="muted small">
								{t.macros.proteinG}{" "}
								{text.fmt(t.units.grams, {
									value: text.number(day.nutrition.proteinG),
								})}
							</span>
						)}
						<GoalBar
							value={day.nutrition.proteinG}
							target={proteinGoal}
							label={`${t.macros.proteinG}: ${goalText(proteinGoal, "grams")}`}
						/>
					</>
				)}
			</div>
		</li>
	);
}

export function WeekOverview({
	result,
	text,
	reload,
	header,
}: ViewProps<WeekOverviewResult>) {
	const { t } = text;
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	const go = async (weekStart: string) => {
		setBusy(true);
		setFailed(false);
		try {
			await reload("show_week_overview", { weekStart });
		} catch {
			setFailed(true);
		} finally {
			setBusy(false);
		}
	};
	const { training, nutrition } = result;
	const energyGoal = goal(nutrition.goals, "energyKcal");
	const proteinGoal = goal(nutrition.goals, "proteinG");
	const trainingParts = [
		training.strengthSessions > 0 &&
			text.plural(training.strengthSessions, t.week.sessions),
		training.runs > 0 && text.plural(training.runs, t.week.runs),
		training.rides > 0 && text.plural(training.rides, t.week.rides),
	].filter(Boolean);
	return (
		<section aria-busy={busy}>
			<header className="toolbar">
				<div>
					<h2>
						{text.fmt(t.week.title, {
							date: text.day(result.weekStart, "short"),
						})}
					</h2>
					{result.isCurrentWeek && (
						<p className="muted small">{t.week.thisWeek}</p>
					)}
				</div>
				<div className="actions">
					<button
						type="button"
						className="icon-button"
						aria-label={t.week.previous}
						title={t.week.previous}
						disabled={busy}
						onClick={() => void go(result.previousWeekStart)}
					>
						‹
					</button>
					<button
						type="button"
						className="icon-button"
						aria-label={t.week.next}
						title={t.week.next}
						disabled={busy}
						onClick={() => void go(result.nextWeekStart)}
					>
						›
					</button>
					{header}
				</div>
			</header>
			{failed && (
				<p className="notice danger" role="alert">
					{t.common.error}
				</p>
			)}
			<div className="summary">
				<div className="stat">
					<span className="label">{t.week.training}</span>
					<strong>
						{trainingParts.length ? trainingParts.join(" · ") : t.week.rest}
					</strong>
					{training.distanceMeters > 0 && (
						<span className="muted small">
							{text.fmt(t.units.km, {
								value: text.number(training.distanceMeters / 1000, 1),
							})}{" "}
							· {minutes(training.durationSeconds, text)}
						</span>
					)}
				</div>
				<div className="stat">
					<span className="label">{t.week.averageEnergy}</span>
					<strong>
						{nutrition.energyAverageKcal === null
							? t.week.noAverage
							: text.fmt(t.units.kcal, {
									value: text.number(nutrition.energyAverageKcal),
								})}
					</strong>
					<GoalBar
						value={nutrition.energyAverageKcal}
						target={energyGoal}
						label={t.week.averageEnergy}
					/>
					<span className="muted small">
						{text.fmt(t.week.loggedDays, { count: nutrition.loggedDays })}
					</span>
				</div>
				<div className="stat">
					<span className="label">{t.week.averageProtein}</span>
					<strong>
						{nutrition.proteinAverageG === null
							? t.week.noAverage
							: text.fmt(t.units.grams, {
									value: text.number(nutrition.proteinAverageG),
								})}
					</strong>
					<GoalBar
						value={nutrition.proteinAverageG}
						target={proteinGoal}
						label={t.week.averageProtein}
					/>
				</div>
			</div>
			<ol className="days">
				{result.days.map((day) => (
					<Day key={day.date} day={day} text={text} />
				))}
			</ol>
		</section>
	);
}
