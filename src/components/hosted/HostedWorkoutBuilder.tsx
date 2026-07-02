import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { getConvexErrorMessage } from "#/lib/convexError";

type StrengthBlock = {
	blockId: string;
	exerciseName: string;
	instructions?: string;
	defaultSets?: number;
	defaultReps?: number;
	defaultWeight?: number;
	unit?: "kg" | "lbs";
	percentageOfOneRepMax?: number;
};

type Level = "rx" | "l1" | "l2" | "l3";

type Movement = {
	// Client-only stable id so editable movement rows keep focus/state when
	// siblings are added or removed. Stripped before persisting (see handleSubmit).
	id: string;
	name: string;
	reps?: number;
	weight?: number;
	unit?: "kg" | "lbs";
	notes?: string;
};

type WodBlock = {
	blockId: string;
	name: string;
	type: "forTime" | "amrap" | "emom" | "load";
	description?: string;
	repScheme?: string;
	timeCapSeconds?: number;
	durationSeconds?: number;
	levels: {
		level: Level;
		label: string;
		description?: string;
		movements: Movement[];
	}[];
};

function emptyMovement(): Movement {
	return { id: crypto.randomUUID(), name: "" };
}

const defaultLevels: WodBlock["levels"] = [
	{ level: "rx", label: "Rx", movements: [emptyMovement()] },
	{ level: "l1", label: "L1", movements: [emptyMovement()] },
	{ level: "l2", label: "L2", movements: [emptyMovement()] },
	{ level: "l3", label: "L3", movements: [emptyMovement()] },
];

function newBlockId() {
	return crypto.randomUUID();
}

// Persisted movements have no client id; add one when seeding edit state.
type PersistedMovement = Omit<Movement, "id">;
type PersistedWodBlock = Omit<WodBlock, "levels"> & {
	levels: (Omit<WodBlock["levels"][number], "movements"> & {
		movements: PersistedMovement[];
	})[];
};

export type HostedWorkoutBuilderInitial = {
	title: string;
	notes?: string;
	scheduledAt?: number;
	hostParticipation: "hostOnly" | "hostAndParticipate";
	template: {
		strengthBlocks: StrengthBlock[];
		wodBlocks: PersistedWodBlock[];
	};
};

function withMovementIds(blocks: PersistedWodBlock[]): WodBlock[] {
	return blocks.map((block) => ({
		...block,
		levels: block.levels.map((level) => ({
			...level,
			movements: level.movements.map((movement) => ({
				id: crypto.randomUUID(),
				...movement,
			})),
		})),
	}));
}

function parseOptionalNumber(value: string): number | undefined {
	if (value.trim() === "") return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

// Convert an epoch-ms timestamp to a local "YYYY-MM-DDTHH:mm" value for a
// datetime-local input, and back.
function toDateTimeLocal(ms: number): string {
	const date = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
		date.getDate(),
	)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function HostedWorkoutBuilder({
	hostedWorkoutId,
	initial,
	onSaved,
}: {
	// When provided, the builder edits an existing draft via updateDraft;
	// otherwise it creates a new draft via createDraft.
	hostedWorkoutId?: Id<"hostedWorkouts">;
	initial?: HostedWorkoutBuilderInitial;
	onSaved: (id: string) => void;
}) {
	const createDraft = useMutation(api.hostedWorkouts.createDraft);
	const updateDraft = useMutation(api.hostedWorkouts.updateDraft);
	const [title, setTitle] = useState(initial?.title ?? "");
	const [notes, setNotes] = useState(initial?.notes ?? "");
	const [scheduledAt, setScheduledAt] = useState(
		initial?.scheduledAt ? toDateTimeLocal(initial.scheduledAt) : "",
	);
	const [hostParticipation, setHostParticipation] = useState<
		"hostOnly" | "hostAndParticipate"
	>(initial?.hostParticipation ?? "hostOnly");
	const [strengthBlocks, setStrengthBlocks] = useState<StrengthBlock[]>(
		initial?.template.strengthBlocks ?? [],
	);
	const [wodBlocks, setWodBlocks] = useState<WodBlock[]>(() =>
		initial ? withMovementIds(initial.template.wodBlocks) : [],
	);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (saving) return;
		setSaving(true);
		setError("");
		try {
			const template = {
				strengthBlocks: strengthBlocks.map((block) => ({
					...block,
					exerciseName: block.exerciseName.trim(),
					instructions: block.instructions?.trim() || undefined,
				})),
				wodBlocks: wodBlocks.map((block) => ({
					...block,
					name: block.name.trim(),
					description: block.description?.trim() || undefined,
					levels: block.levels.map((level) => ({
						...level,
						description: level.description?.trim() || undefined,
						movements: level.movements
							.filter((movement) => movement.name.trim().length > 0)
							.map((movement) => ({
								name: movement.name.trim(),
								reps: movement.reps,
								weight: movement.weight,
								unit: movement.unit,
								notes: movement.notes?.trim() || undefined,
							})),
					})),
				})),
			};
			const scheduledMs = scheduledAt
				? new Date(scheduledAt).getTime()
				: undefined;
			if (hostedWorkoutId) {
				await updateDraft({
					id: hostedWorkoutId,
					title,
					notes: notes.trim() || undefined,
					scheduledAt: scheduledMs,
					hostParticipation,
					template,
				});
				onSaved(hostedWorkoutId);
			} else {
				const id = await createDraft({
					title,
					notes: notes.trim() || undefined,
					scheduledAt: scheduledMs,
					hostParticipation,
					template,
				});
				onSaved(id);
			}
		} catch (err) {
			setError(getConvexErrorMessage(err, "Failed to save workout"));
		} finally {
			setSaving(false);
		}
	}

	function updateBlock(blockIndex: number, patch: Partial<WodBlock>) {
		setWodBlocks((prev) =>
			prev.map((block, bi) =>
				bi === blockIndex ? { ...block, ...patch } : block,
			),
		);
	}

	function updateLevelDescription(
		blockIndex: number,
		levelKey: Level,
		description: string,
	) {
		setWodBlocks((prev) =>
			prev.map((block, bi) =>
				bi === blockIndex
					? {
							...block,
							levels: block.levels.map((entry) =>
								entry.level === levelKey ? { ...entry, description } : entry,
							),
						}
					: block,
			),
		);
	}

	function mutateLevel(
		blockIndex: number,
		levelKey: Level,
		mutator: (movements: Movement[]) => Movement[],
	) {
		setWodBlocks((prev) =>
			prev.map((block, bi) =>
				bi === blockIndex
					? {
							...block,
							levels: block.levels.map((entry) =>
								entry.level === levelKey
									? { ...entry, movements: mutator(entry.movements) }
									: entry,
							),
						}
					: block,
			),
		);
	}

	function updateMovement(
		blockIndex: number,
		levelKey: Level,
		movementIndex: number,
		patch: Partial<Movement>,
	) {
		mutateLevel(blockIndex, levelKey, (movements) =>
			movements.map((movement, mi) =>
				mi === movementIndex ? { ...movement, ...patch } : movement,
			),
		);
	}

	function addMovement(blockIndex: number, levelKey: Level) {
		mutateLevel(blockIndex, levelKey, (movements) => [
			...movements,
			emptyMovement(),
		]);
	}

	function removeMovement(
		blockIndex: number,
		levelKey: Level,
		movementIndex: number,
	) {
		mutateLevel(blockIndex, levelKey, (movements) =>
			movements.length > 1
				? movements.filter((_, mi) => mi !== movementIndex)
				: movements,
		);
	}

	return (
		<form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
			<div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
				<label
					htmlFor="hosted-title"
					className="text-xs font-semibold text-[var(--text-muted)]"
				>
					Title
				</label>
				<input
					id="hosted-title"
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					className="mt-2 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)]"
					placeholder="Saturday class"
				/>
				<textarea
					value={notes}
					onChange={(event) => setNotes(event.target.value)}
					className="mt-3 min-h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)]"
					placeholder="Workout notes"
				/>
				<label
					htmlFor="hosted-scheduled-at"
					className="mt-3 block text-xs font-semibold text-[var(--text-muted)]"
				>
					Scheduled time (optional)
				</label>
				<input
					id="hosted-scheduled-at"
					type="datetime-local"
					value={scheduledAt}
					onChange={(event) => setScheduledAt(event.target.value)}
					className="mt-2 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)]"
				/>
				<div className="mt-3 grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={() => setHostParticipation("hostOnly")}
						className={`rounded-lg border px-3 py-2 text-sm ${
							hostParticipation === "hostOnly"
								? "border-[var(--accent)] text-[var(--accent)]"
								: "border-[var(--border)] text-white"
						}`}
					>
						Host only
					</button>
					<button
						type="button"
						onClick={() => setHostParticipation("hostAndParticipate")}
						className={`rounded-lg border px-3 py-2 text-sm ${
							hostParticipation === "hostAndParticipate"
								? "border-[var(--accent)] text-[var(--accent)]"
								: "border-[var(--border)] text-white"
						}`}
					>
						Host and participate
					</button>
				</div>
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold text-white">Strength</h2>
					<button
						type="button"
						onClick={() =>
							setStrengthBlocks((prev) => [
								...prev,
								{ blockId: newBlockId(), exerciseName: "" },
							])
						}
						className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-white"
					>
						<Plus size={14} /> Add
					</button>
				</div>
				{strengthBlocks.map((block, index) => (
					<div
						key={block.blockId}
						className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
					>
						<input
							value={block.exerciseName}
							onChange={(event) =>
								setStrengthBlocks((prev) =>
									prev.map((item, itemIndex) =>
										itemIndex === index
											? { ...item, exerciseName: event.target.value }
											: item,
									),
								)
							}
							aria-label={`Strength block ${index + 1} exercise`}
							className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)]"
							placeholder="Exercise"
						/>
						<textarea
							value={block.instructions ?? ""}
							onChange={(event) =>
								setStrengthBlocks((prev) =>
									prev.map((item, itemIndex) =>
										itemIndex === index
											? { ...item, instructions: event.target.value }
											: item,
									),
								)
							}
							className="mt-2 min-h-16 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)]"
							placeholder="5x5 @ 75% 1RM"
						/>
						<button
							type="button"
							onClick={() =>
								setStrengthBlocks((prev) =>
									prev.filter((item) => item.blockId !== block.blockId),
								)
							}
							className="mt-2 flex items-center gap-1.5 text-xs text-red-400"
						>
							<Trash2 size={13} /> Remove
						</button>
					</div>
				))}
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold text-white">WODs</h2>
					<button
						type="button"
						onClick={() =>
							setWodBlocks((prev) => [
								...prev,
								{
									blockId: newBlockId(),
									name: "",
									type: "forTime",
									levels: structuredClone(defaultLevels),
								},
							])
						}
						className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-white"
					>
						<Plus size={14} /> Add
					</button>
				</div>
				{wodBlocks.map((block, index) => (
					<div
						key={block.blockId}
						className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
					>
						<input
							value={block.name}
							onChange={(event) =>
								setWodBlocks((prev) =>
									prev.map((item, itemIndex) =>
										itemIndex === index
											? { ...item, name: event.target.value }
											: item,
									),
								)
							}
							aria-label={`WOD ${index + 1} name`}
							className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)]"
							placeholder="WOD name"
						/>
						<div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
							{(["forTime", "amrap", "emom", "load"] as const).map((type) => (
								<button
									key={type}
									type="button"
									onClick={() =>
										setWodBlocks((prev) =>
											prev.map((item, itemIndex) =>
												itemIndex === index ? { ...item, type } : item,
											),
										)
									}
									className={`rounded-lg border px-2 py-2 text-xs ${
										block.type === type
											? "border-[var(--accent)] text-[var(--accent)]"
											: "border-[var(--border)] text-white"
									}`}
								>
									{type}
								</button>
							))}
						</div>
						<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
							<input
								value={block.repScheme ?? ""}
								onChange={(event) =>
									updateBlock(index, {
										repScheme: event.target.value.trim()
											? event.target.value
											: undefined,
									})
								}
								aria-label={`WOD ${index + 1} rep scheme`}
								className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-white placeholder:text-[var(--text-muted)]"
								placeholder="Rep scheme (e.g. 21-15-9)"
							/>
							{block.type !== "load" && (
								<div className="flex items-center gap-2">
									<input
										type="number"
										inputMode="numeric"
										min={0}
										value={
											block.type === "forTime"
												? block.timeCapSeconds
													? block.timeCapSeconds / 60
													: ""
												: block.durationSeconds
													? block.durationSeconds / 60
													: ""
										}
										onChange={(event) => {
											const minutes = parseOptionalNumber(event.target.value);
											const seconds =
												minutes === undefined ? undefined : minutes * 60;
											updateBlock(
												index,
												block.type === "forTime"
													? { timeCapSeconds: seconds }
													: { durationSeconds: seconds },
											);
										}}
										aria-label={`WOD ${index + 1} ${
											block.type === "forTime" ? "time cap" : "duration"
										} in minutes`}
										className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-white placeholder:text-[var(--text-muted)]"
										placeholder={
											block.type === "forTime"
												? "Time cap (min)"
												: "Duration (min)"
										}
									/>
									<span className="text-xs text-[var(--text-muted)]">min</span>
								</div>
							)}
						</div>
						{block.levels.map((level) => (
							<div
								key={level.level}
								className="mt-3 rounded-lg bg-[var(--surface-2)] p-3"
							>
								<p className="text-xs font-semibold text-[var(--accent)]">
									{level.label}
								</p>
								<div className="mt-2 flex flex-col gap-2">
									{level.movements.map((movement, movementIndex) => (
										<div
											key={movement.id}
											className="grid grid-cols-[1fr_56px_64px_60px_28px] items-center gap-1.5"
										>
											<input
												value={movement.name}
												onChange={(event) =>
													updateMovement(index, level.level, movementIndex, {
														name: event.target.value,
													})
												}
												aria-label={`${level.label} movement ${movementIndex + 1} name`}
												className="h-9 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 text-xs text-white placeholder:text-[var(--text-muted)]"
												placeholder="Movement"
											/>
											<input
												type="number"
												inputMode="numeric"
												min={0}
												value={movement.reps ?? ""}
												onChange={(event) =>
													updateMovement(index, level.level, movementIndex, {
														reps: parseOptionalNumber(event.target.value),
													})
												}
												aria-label={`${level.label} movement ${movementIndex + 1} reps`}
												className="h-9 w-full rounded-lg border border-[var(--border)] bg-black/20 px-2 text-xs text-white placeholder:text-[var(--text-muted)]"
												placeholder="reps"
											/>
											<input
												type="number"
												inputMode="decimal"
												min={0}
												step={2.5}
												value={movement.weight ?? ""}
												onChange={(event) =>
													updateMovement(index, level.level, movementIndex, {
														weight: parseOptionalNumber(event.target.value),
													})
												}
												aria-label={`${level.label} movement ${movementIndex + 1} weight`}
												className="h-9 w-full rounded-lg border border-[var(--border)] bg-black/20 px-2 text-xs text-white placeholder:text-[var(--text-muted)]"
												placeholder="kg"
											/>
											<select
												value={movement.unit ?? "kg"}
												onChange={(event) =>
													updateMovement(index, level.level, movementIndex, {
														unit: event.target.value as "kg" | "lbs",
													})
												}
												aria-label={`${level.label} movement ${movementIndex + 1} unit`}
												className="h-9 w-full rounded-lg border border-[var(--border)] bg-black/20 px-1 text-xs text-white"
											>
												<option value="kg">kg</option>
												<option value="lbs">lbs</option>
											</select>
											<button
												type="button"
												onClick={() =>
													removeMovement(index, level.level, movementIndex)
												}
												disabled={level.movements.length <= 1}
												aria-label={`Remove ${level.label} movement ${movementIndex + 1}`}
												className="flex h-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-400 disabled:opacity-30"
											>
												<Trash2 size={13} />
											</button>
										</div>
									))}
								</div>
								<button
									type="button"
									onClick={() => addMovement(index, level.level)}
									className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)]"
								>
									<Plus size={12} /> Add movement
								</button>
								<input
									value={level.description ?? ""}
									onChange={(event) =>
										updateLevelDescription(
											index,
											level.level,
											event.target.value,
										)
									}
									aria-label={`${level.label} notes`}
									className="mt-2 h-8 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 text-xs text-white placeholder:text-[var(--text-muted)]"
									placeholder="Level notes (optional)"
								/>
							</div>
						))}
						<button
							type="button"
							onClick={() =>
								setWodBlocks((prev) =>
									prev.filter((item) => item.blockId !== block.blockId),
								)
							}
							className="mt-3 flex items-center gap-1.5 text-xs text-red-400"
						>
							<Trash2 size={13} /> Remove
						</button>
					</div>
				))}
			</div>

			{error && <p className="text-sm text-red-400">{error}</p>}
			<button
				type="submit"
				disabled={saving}
				className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
			>
				<Save size={15} />{" "}
				{saving ? "Saving..." : hostedWorkoutId ? "Save changes" : "Save draft"}
			</button>
		</form>
	);
}
