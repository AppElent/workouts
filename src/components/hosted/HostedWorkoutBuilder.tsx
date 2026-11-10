import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import {
	HOSTED_LEVELS,
	type HostedLevel,
	type LoadUnit,
	WOD_TYPES,
	type WodMovement,
} from "@foundry/core";
import { useMutation } from "convex/react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import {
	HOSTED_LEVEL_LABELS,
	WOD_TIMING,
	WOD_TYPE_LABELS,
	wodTimingFromMinutes,
	wodTimingMinutes,
} from "#/components/hosted/wodBlock";
import { useConvexErrorMessage } from "#/lib/convexError";
import { useExercises } from "#/lib/exercises";

type HostedWorkout = Doc<"hostedWorkouts">;
type StrengthBlock = HostedWorkout["template"]["strengthBlocks"][number];
type PersistedWodBlock = HostedWorkout["template"]["wodBlocks"][number];
type PersistedLevel = PersistedWodBlock["levels"][number];

// Movement rows carry a client-only id so editable rows keep focus and state
// when siblings are added or removed; handleSubmit strips it.
type Movement = WodMovement & { id: string };
type Level = Omit<PersistedLevel, "movements"> & { movements: Movement[] };
type WodBlock = Omit<PersistedWodBlock, "levels"> & { levels: Level[] };

type HostedWorkoutBuilderInitial = Pick<
	HostedWorkout,
	"title" | "notes" | "scheduledAt" | "hostParticipation" | "template"
>;

function emptyMovement(): Movement {
	return { id: crypto.randomUUID(), name: "" };
}

function defaultLevels(): Level[] {
	return HOSTED_LEVELS.map((level) => ({
		level,
		label: HOSTED_LEVEL_LABELS[level],
		movements: [emptyMovement()],
	}));
}

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
	const exercises = useExercises();
	const errorMessage = useConvexErrorMessage();
	const [title, setTitle] = useState(initial?.title ?? "");
	const [notes, setNotes] = useState(initial?.notes ?? "");
	const [scheduledAt, setScheduledAt] = useState(
		initial?.scheduledAt ? toDateTimeLocal(initial.scheduledAt) : "",
	);
	const [hostParticipation, setHostParticipation] = useState<
		HostedWorkout["hostParticipation"]
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
							.map(({ id: _id, ...movement }) => ({
								...movement,
								name: movement.name.trim(),
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
			setError(errorMessage(err, "Failed to save workout"));
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
		levelKey: HostedLevel,
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
		levelKey: HostedLevel,
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
		levelKey: HostedLevel,
		movementIndex: number,
		patch: Partial<Movement>,
	) {
		mutateLevel(blockIndex, levelKey, (movements) =>
			movements.map((movement, mi) =>
				mi === movementIndex ? { ...movement, ...patch } : movement,
			),
		);
	}

	function addMovement(blockIndex: number, levelKey: HostedLevel) {
		mutateLevel(blockIndex, levelKey, (movements) => [
			...movements,
			emptyMovement(),
		]);
	}

	function removeMovement(
		blockIndex: number,
		levelKey: HostedLevel,
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
								{ blockId: crypto.randomUUID(), exerciseName: "" },
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
						<select
							value={block.exerciseId ?? ""}
							onChange={(event) => {
								const value = event.target.value;
								const linked = exercises.find((ex) => ex._id === value);
								setStrengthBlocks((prev) =>
									prev.map((item, itemIndex) =>
										itemIndex === index
											? {
													...item,
													exerciseId: linked?._id,
													exerciseName: linked
														? linked.name
														: item.exerciseName,
												}
											: item,
									),
								);
							}}
							aria-label={`Strength block ${index + 1} link to a logged exercise`}
							className="mt-2 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white"
						>
							<option value="">Not linked (info only)</option>
							{exercises.map((ex) => (
								<option key={ex._id} value={ex._id}>
									{ex.name}
								</option>
							))}
						</select>
						{block.exerciseId && (
							<p className="mt-1 text-xs text-[var(--text-muted)]">
								Participants can log sets for this exercise in their session.
							</p>
						)}
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
							className="mt-2 flex items-center gap-1.5 text-xs text-[var(--danger)]"
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
									blockId: crypto.randomUUID(),
									name: "",
									type: "forTime",
									levels: defaultLevels(),
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
							{WOD_TYPES.map((type) => (
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
									{WOD_TYPE_LABELS[type]}
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
							{WOD_TIMING[block.type] && (
								<div className="flex items-center gap-2">
									<input
										type="number"
										inputMode="numeric"
										min={0}
										value={wodTimingMinutes(block) ?? ""}
										onChange={(event) =>
											updateBlock(
												index,
												wodTimingFromMinutes(
													block.type,
													parseOptionalNumber(event.target.value),
												),
											)
										}
										aria-label={`WOD ${index + 1} ${WOD_TIMING[
											block.type
										]?.label.toLowerCase()} in minutes`}
										className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-white placeholder:text-[var(--text-muted)]"
										placeholder={`${WOD_TIMING[block.type]?.label} (min)`}
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
														unit: event.target.value as LoadUnit,
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
												className="flex h-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-30"
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
							className="mt-3 flex items-center gap-1.5 text-xs text-[var(--danger)]"
						>
							<Trash2 size={13} /> Remove
						</button>
					</div>
				))}
			</div>

			{error && <p className="text-sm text-[var(--danger)]">{error}</p>}
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
