import { useState } from "react";
import type { HomeResult } from "../types";
import type { ViewProps } from "./ViewRoot";
import { GoalBar, goal } from "./WeekOverview";

/** The `open_foundry` view: today, the latest session, this week. */
export function Home({ result, text, reload, header }: ViewProps<HomeResult>) {
	const { t } = text;
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	const open = async (tool: string, args: Record<string, unknown>) => {
		setBusy(true);
		setFailed(false);
		try {
			await reload(tool, args);
		} catch {
			setFailed(true);
		} finally {
			setBusy(false);
		}
	};
	const { today, session, week } = result;
	const kcal = today.nutrition.energyKcal;
	const protein = today.nutrition.proteinG;
	const energyGoal = goal(today.goals, "energyKcal");
	const proteinGoal = goal(today.goals, "proteinG");
	const goalText = (target: typeof energyGoal, unit: "kcal" | "grams") =>
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
	const trainingParts = [
		week.training.strengthSessions > 0 &&
			text.plural(week.training.strengthSessions, t.week.sessions),
		week.training.runs > 0 && text.plural(week.training.runs, t.week.runs),
		week.training.rides > 0 && text.plural(week.training.rides, t.week.rides),
	].filter(Boolean);
	return (
		<section aria-busy={busy}>
			<header className="toolbar">
				<div>
					<h2>{t.home.title}</h2>
					<p className="muted small">{text.day(today.date, "long")}</p>
				</div>
				<div className="actions">{header}</div>
			</header>
			{failed && (
				<p className="notice danger" role="alert">
					{t.common.error}
				</p>
			)}
			<div className="home-cards">
				<article className="stat">
					<span className="label">{t.home.today}</span>
					{today.nutrition.entryCount === 0 || kcal === null ? (
						<strong>{t.home.nothingToday}</strong>
					) : (
						<>
							<strong>
								{text.fmt(t.units.kcal, { value: text.number(kcal) })}
							</strong>
							<GoalBar
								value={kcal}
								target={energyGoal}
								label={`${t.macros.energyKcal}: ${goalText(energyGoal, "kcal")}`}
							/>
							{energyGoal && (
								<span className="muted small">
									{goalText(energyGoal, "kcal")}
								</span>
							)}
							{protein !== null && (
								<span className="muted small">
									{t.macros.proteinG}{" "}
									{text.fmt(t.units.grams, { value: text.number(protein) })}
								</span>
							)}
							<GoalBar
								value={protein}
								target={proteinGoal}
								label={`${t.macros.proteinG}: ${goalText(proteinGoal, "grams")}`}
							/>
						</>
					)}
				</article>
				<article className="stat">
					<span className="label">
						{session?.status === "active"
							? t.home.activeSession
							: t.home.latestSession}
					</span>
					{session ? (
						<>
							<strong>{session.name || t.sports.strength}</strong>
							<span className="muted small">
								{text.day(session.startedAt.slice(0, 10), "short")} ·{" "}
								{text.plural(session.setCount, t.home.sets)}
							</span>
							{session.exercises.length > 0 && (
								<ul className="link-list">
									{session.exercises.map((exercise) => (
										<li key={exercise.id}>
											<button
												type="button"
												className="link-button"
												disabled={busy}
												aria-label={text.fmt(t.home.progressFor, {
													exercise: exercise.name,
												})}
												onClick={() =>
													void open("show_exercise_progress", {
														exerciseId: exercise.id,
													})
												}
											>
												{exercise.name} ›
											</button>
										</li>
									))}
								</ul>
							)}
						</>
					) : (
						<strong>{t.home.noSession}</strong>
					)}
				</article>
				<article className="stat">
					<span className="label">{t.week.thisWeek}</span>
					<strong>
						{trainingParts.length ? trainingParts.join(" · ") : t.week.rest}
					</strong>
					<span className="muted small">
						{text.fmt(t.week.loggedDays, { count: week.loggedDays })}
					</span>
					<button
						type="button"
						className="link-button"
						disabled={busy}
						onClick={() =>
							void open("show_week_overview", { weekStart: week.weekStart })
						}
					>
						{t.home.openWeek} ›
					</button>
				</article>
			</div>
		</section>
	);
}
