import { useEffect, useRef, useState } from "react";
import type { FoodLogReviewResult, MacroKey, Macros } from "../types";
import {
	addItem,
	changeItem,
	type DraftItem,
	draftText,
	FoodConflictError,
	findItem,
	itemMacros,
	logUnsaved,
	parseQuantity,
	removalsFinal,
	savedContext,
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
	value,
	disabled,
	onChange,
}: {
	item: DraftItem;
	text: ViewText;
	value: string;
	disabled: boolean;
	onChange: (value: string) => void;
}) {
	const invalid = parseQuantity(value) === null;
	const errorId = `quantity-error-${item.row}`;
	return (
		<>
			<input
				type="number"
				inputMode="decimal"
				min="0"
				step="any"
				className="quantity"
				aria-label={text.fmt(text.t.food.quantity, {
					food: text.pick(item.name),
				})}
				aria-invalid={invalid}
				aria-describedby={invalid ? errorId : undefined}
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(event.target.value)}
			/>
			{invalid && (
				<p id={errorId} className="field-error" role="alert">
					{text.t.food.quantityInvalid}
				</p>
			)}
		</>
	);
}

export function FoodLog({
	app,
	result,
	text,
	header,
	bridge,
}: ViewProps<FoodLogReviewResult>) {
	const { t } = text;
	const [items, setItems] = useState<DraftItem[]>(() =>
		startDraft(result.items, result.reviewId),
	);
	const [logging, setLogging] = useState(false);
	// What each quantity field shows; the item keeps the last valid amount.
	const [quantityText, setQuantityText] = useState<Record<number, string>>({});
	// App tools read and answer synchronously, so they keep their own copy.
	const itemsRef = useRef(items);
	itemsRef.current = items;
	const loggingRef = useRef(false);
	const update = (row: number, change: (item: DraftItem) => DraftItem) =>
		setItems((current) =>
			current.map((item) => (item.row === row ? change(item) : item)),
		);

	const { date, meal: mealName } = result;
	useEffect(() => {
		const busy =
			"Foundry is logging this review right now; try again when it is done.";
		const commit = (next: DraftItem[]) => {
			itemsRef.current = next;
			setItems(next);
			return draftText(next);
		};
		const changeRow = (row: number, change: (item: DraftItem) => DraftItem) =>
			commit(
				itemsRef.current.map((item) =>
					item.row === row ? change(item) : item,
				),
			);
		const locked = (item: DraftItem) =>
			item.status === "saved" || item.status === "saving";
		return bridge.set("screen", {
			addItem: async (input) => {
				if (loggingRef.current) return busy;
				const response = await app.callServerTool({
					name: "review_food_log",
					arguments: { date, meal: mealName, items: [input] },
				});
				const content = response.structuredContent as
					| FoodLogReviewResult
					| undefined;
				const added =
					content?.view === "food-log" ? content.items[0] : undefined;
				if (response.isError || !added) {
					const reason = response.content?.find(
						(block) => block.type === "text",
					);
					return `Foundry could not add that food${reason && "text" in reason ? `: ${reason.text}` : "."} Use a foodId and servingIndex from search_foods.`;
				}
				if (loggingRef.current) return busy;
				return commit(addItem(itemsRef.current, added, newKey()));
			},
			setQuantity: async ({ foodId, quantity, servingIndex }) => {
				if (loggingRef.current) return busy;
				const item = findItem(itemsRef.current, foodId);
				if (!item) return `The review has no item with foodId ${foodId}.`;
				if (locked(item))
					return "That item is already logged, so it cannot change here. Change it in the diary with update_diary_entry.";
				if (item.removed)
					return "That item was removed from the review. Add it again with add_item.";
				if (quantity === undefined && servingIndex === undefined)
					return "Give a quantity, a servingIndex, or both.";
				if (
					servingIndex !== undefined &&
					!item.servings.some((entry) => entry.servingIndex === servingIndex)
				)
					return `That food has no servingIndex ${servingIndex}. It offers: ${item.servings.map((entry) => `${entry.servingIndex} = ${entry.label.en}`).join(", ")}.`;
				setQuantityText(({ [item.row]: _, ...rest }) => rest);
				return changeRow(item.row, (current) =>
					changeItem(
						current,
						{
							...(quantity !== undefined ? { quantity } : {}),
							...(servingIndex !== undefined ? { servingIndex } : {}),
						},
						newKey,
					),
				);
			},
			removeItem: async (foodId) => {
				if (loggingRef.current) return busy;
				const item = findItem(itemsRef.current, foodId);
				if (!item) return `The review has no item with foodId ${foodId}.`;
				if (locked(item))
					return "That item is already logged, so it stays. Users delete diary entries in the app.";
				if (item.removed) return draftText(itemsRef.current);
				return changeRow(item.row, (current) => setRemoved(current, true));
			},
		});
	}, [bridge, app, date, mealName]);

	const kept = items.filter((item) => !item.removed);
	const meal = sumMacros(kept.map(itemMacros));
	const day = sumMacros([result.logged, meal]);
	const remaining = unsaved(items);
	const done = kept.length > 0 && kept.every((item) => item.status === "saved");
	const someFailed = items.some((item) => item.status === "failed");
	const quantityFor = (item: DraftItem) =>
		quantityText[item.row] ?? String(item.quantity);
	const invalidQuantity = kept.some(
		(item) => parseQuantity(quantityFor(item)) === null,
	);
	const final = removalsFinal(items);

	const log = async () => {
		loggingRef.current = true;
		setLogging(true);
		let latest = items;
		const savedBefore = items.filter((item) => item.status === "saved").length;
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
				const content = response.structuredContent as
					| { entryId?: string; error?: { code?: string } }
					| undefined;
				if (content?.error?.code === "operationConflict")
					throw new FoodConflictError("log_food conflict");
				if (response.isError || !content?.entryId)
					throw new Error("log_food failed");
				return { entryId: content.entryId };
			},
			(row, change) => {
				latest = latest.map((item) =>
					item.row === row ? { ...item, ...change } : item,
				);
				update(row, (item) => ({ ...item, ...change }));
			},
		);
		loggingRef.current = false;
		setLogging(false);
		if (latest.filter((item) => item.status === "saved").length === savedBefore)
			return;
		void app
			.updateModelContext({
				content: [
					{
						type: "text",
						text: savedContext(latest, result.meal, result.date),
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
								<strong>{text.pick(item.name)}</strong>
								{item.status === "saved" && (
									<span className="badge success">✓ {t.food.saved}</span>
								)}
								{item.status === "failed" && (
									<span className="badge danger">{t.food.failed}</span>
								)}
								{item.removed && (
									<span className="badge">{t.food.removed}</span>
								)}
								{result.canLog &&
									!locked &&
									!logging &&
									!(item.removed && final) && (
										<button
											type="button"
											className="text-button"
											aria-label={text.fmt(
												item.removed ? t.food.restore : t.food.remove,
												{ food: text.pick(item.name) },
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
											value={quantityFor(item)}
											disabled={locked || logging}
											onChange={(value) => {
												setQuantityText((current) => ({
													...current,
													[item.row]: value,
												}));
												const quantity = parseQuantity(value);
												if (quantity !== null)
													update(item.row, (current) =>
														changeItem(current, { quantity }, newKey),
													);
											}}
										/>
										<select
											aria-label={text.fmt(t.food.serving, {
												food: text.pick(item.name),
											})}
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
													{text.pick(serving.label)}
												</option>
											))}
										</select>
									</div>
									{item.conflict && (
										<p className="field-error" role="alert">
											{t.food.conflict}
										</p>
									)}
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
						disabled={logging || invalidQuantity}
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
