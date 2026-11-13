import { useState } from "react";
import type { FoodLogReviewResult, MacroKey, Macros } from "../types";
import {
	changeItem,
	type DraftItem,
	itemMacros,
	logUnsaved,
	setRemoved,
	startDraft,
	sumMacros,
	unsaved,
} from "./foodLogDraft";
import type { ViewText } from "./i18n";
import type { ViewProps } from "./ViewRoot";

const MACROS: readonly MacroKey[] = [
	"energyKcal",
	"proteinG",
	"carbsG",
	"fatG",
];

function newKey() {
	if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function amount(text: ViewText, key: MacroKey, value: number | null) {
	if (value === null) return "–";
	return text.fmt(
		key === "energyKcal" ? text.t.units.kcal : text.t.units.grams,
		{
			value: text.number(value, key === "energyKcal" ? 0 : 1),
		},
	);
}

function MacroLine({ text, macros }: { text: ViewText; macros: Macros }) {
	return (
		<dl className="macro-line">
			{MACROS.map((key) => (
				<div key={key}>
					<dt>{text.t.macros[key]}</dt>
					<dd>{amount(text, key, macros[key])}</dd>
				</div>
			))}
		</dl>
	);
}

function QuantityField({
	item,
	text,
	disabled,
	onChange,
}: {
	item: DraftItem;
	text: ViewText;
	disabled: boolean;
	onChange: (quantity: number) => void;
}) {
	const [draft, setDraft] = useState(String(item.quantity));
	return (
		<input
			type="number"
			inputMode="decimal"
			min="0"
			step="any"
			className="quantity"
			aria-label={text.fmt(text.t.food.quantity, { food: item.name })}
			value={draft}
			disabled={disabled}
			onChange={(event) => {
				setDraft(event.target.value);
				const value = Number(event.target.value);
				if (Number.isFinite(value) && value > 0 && value <= 10000)
					onChange(value);
			}}
			onBlur={() => setDraft(String(item.quantity))}
		/>
	);
}

export function FoodLog({
	app,
	result,
	text,
	header,
}: ViewProps<FoodLogReviewResult>) {
	const { t } = text;
	const [items, setItems] = useState<DraftItem[]>(() =>
		startDraft(result.items, newKey),
	);
	const [logging, setLogging] = useState(false);
	const update = (row: number, change: (item: DraftItem) => DraftItem) =>
		setItems((current) =>
			current.map((item) => (item.row === row ? change(item) : item)),
		);

	const kept = items.filter((item) => !item.removed);
	const meal = sumMacros(kept.map(itemMacros));
	const day = sumMacros([result.logged, meal]);
	const remaining = unsaved(items);
	const done = kept.length > 0 && kept.every((item) => item.status === "saved");
	const someFailed = items.some((item) => item.status === "failed");

	const log = async () => {
		setLogging(true);
		const saved: DraftItem[] = [];
		await logUnsaved(
			items,
			async (item) => {
				const response = await app.callServerTool({
					name: "log_food",
					arguments: {
						idempotencyKey: item.key,
						date: result.date,
						meal: result.meal,
						foodId: item.foodId,
						servingIndex: item.servingIndex,
						quantity: item.quantity,
					},
				});
				const entryId = (response.structuredContent as { entryId?: string })
					?.entryId;
				if (response.isError || !entryId) throw new Error("log_food failed");
				saved.push(item);
				return { entryId };
			},
			(row, change) => update(row, (item) => ({ ...item, ...change })),
		);
		setLogging(false);
		if (saved.length === 0) return;
		const names = saved
			.map((item) => {
				const serving = item.servings.find(
					(entry) => entry.servingIndex === item.servingIndex,
				);
				return `${item.quantity} × ${serving?.label ?? "serving"} ${item.name}`;
			})
			.join("; ");
		void app
			.updateModelContext({
				content: [
					{
						type: "text",
						text: `From the review_food_log view the user logged ${saved.length} item(s) to ${result.meal} on ${result.date}: ${names}. They are saved in Foundry; do not log them again.`,
					},
				],
			})
			.catch(() => undefined);
	};

	return (
		<section aria-busy={logging}>
			<header className="toolbar">
				<h2>
					{text.fmt(t.food.title, {
						meal: t.meals[result.meal],
						date: text.day(result.date, "long"),
					})}
				</h2>
				<div className="actions">{header}</div>
			</header>
			<ul className="food-items">
				{items.map((item) => {
					const locked = item.status === "saved" || item.status === "saving";
					return (
						<li
							key={item.row}
							className="food-item"
							data-removed={item.removed || undefined}
							data-status={item.status}
						>
							<div className="food-head">
								<strong>{item.name}</strong>
								{item.status === "saved" && (
									<span className="badge success">✓ {t.food.saved}</span>
								)}
								{item.status === "failed" && (
									<span className="badge danger">{t.food.failed}</span>
								)}
								{item.removed && (
									<span className="badge">{t.food.removed}</span>
								)}
								{result.canLog && !locked && !logging && (
									<button
										type="button"
										className="text-button"
										aria-label={text.fmt(
											item.removed ? t.food.restore : t.food.remove,
											{ food: item.name },
										)}
										onClick={() =>
											update(item.row, (current) =>
												setRemoved(current, !current.removed),
											)
										}
									>
										{item.removed ? "↺" : "×"}
									</button>
								)}
							</div>
							{!item.removed && (
								<>
									<div className="food-controls">
										<QuantityField
											item={item}
											text={text}
											disabled={locked || logging}
											onChange={(quantity) =>
												update(item.row, (current) =>
													changeItem(current, { quantity }, newKey),
												)
											}
										/>
										<select
											aria-label={text.fmt(t.food.serving, { food: item.name })}
											value={item.servingIndex}
											disabled={locked || logging}
											onChange={(event) =>
												update(item.row, (current) =>
													changeItem(
														current,
														{ servingIndex: Number(event.target.value) },
														newKey,
													),
												)
											}
										>
											{item.servings.map((serving) => (
												<option
													key={serving.servingIndex}
													value={serving.servingIndex}
												>
													{serving.label}
												</option>
											))}
										</select>
									</div>
									<MacroLine text={text} macros={itemMacros(item)} />
								</>
							)}
						</li>
					);
				})}
			</ul>
			<table className="totals">
				<thead>
					<tr>
						<td />
						<th scope="col">{t.food.thisMeal}</th>
						<th scope="col">{t.food.alreadyLogged}</th>
						<th scope="col">{t.food.dayTotal}</th>
					</tr>
				</thead>
				<tbody>
					{MACROS.map((key) => {
						const goal = result.goals.find((entry) => entry.macro === key);
						return (
							<tr key={key}>
								<th scope="row">{t.macros[key]}</th>
								<td>{amount(text, key, meal[key])}</td>
								<td>{amount(text, key, result.logged[key])}</td>
								<td>
									<strong>{amount(text, key, day[key])}</strong>
									{goal && (
										<span className="muted small goal">
											{text.fmt(
												goal.direction === "min"
													? t.common.goalMin
													: t.common.goalMax,
												{ target: amount(text, key, goal.target) },
											)}
										</span>
									)}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			<footer className="food-footer">
				{!result.canLog && <p className="notice">{t.food.readOnly}</p>}
				{result.canLog && done && (
					<p className="notice success" role="status">
						{t.food.allSaved}
					</p>
				)}
				{result.canLog && someFailed && !logging && (
					<p className="notice danger" role="alert">
						{t.food.someFailed}
					</p>
				)}
				{result.canLog && kept.length === 0 && (
					<p className="muted">{t.food.nothingLeft}</p>
				)}
				{result.canLog && remaining.length > 0 && (
					<button
						type="button"
						className="primary"
						disabled={logging}
						onClick={() => void log()}
					>
						{logging
							? t.food.logging
							: someFailed
								? t.food.retry
								: text.plural(remaining.length, t.food.log)}
					</button>
				)}
			</footer>
		</section>
	);
}
