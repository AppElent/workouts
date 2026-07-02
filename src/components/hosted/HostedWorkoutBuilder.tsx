import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";

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

type WodBlock = {
	blockId: string;
	name: string;
	type: "forTime" | "amrap" | "emom" | "load";
	description?: string;
	levels: {
		level: Level;
		label: string;
		description?: string;
		movements: { name: string; notes?: string }[];
	}[];
};

const defaultLevels: WodBlock["levels"] = [
	{ level: "rx", label: "Rx", movements: [{ name: "" }] },
	{ level: "l1", label: "L1", movements: [{ name: "" }] },
	{ level: "l2", label: "L2", movements: [{ name: "" }] },
	{ level: "l3", label: "L3", movements: [{ name: "" }] },
];

function newBlockId() {
	return crypto.randomUUID();
}

export function HostedWorkoutBuilder({
	onCreated,
}: {
	onCreated: (id: string) => void;
}) {
	const createDraft = useMutation(api.hostedWorkouts.createDraft);
	const [title, setTitle] = useState("");
	const [notes, setNotes] = useState("");
	const [hostParticipation, setHostParticipation] = useState<
		"hostOnly" | "hostAndParticipate"
	>("hostOnly");
	const [strengthBlocks, setStrengthBlocks] = useState<StrengthBlock[]>([]);
	const [wodBlocks, setWodBlocks] = useState<WodBlock[]>([]);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (saving) return;
		setSaving(true);
		setError("");
		try {
			const id = await createDraft({
				title,
				notes: notes.trim() || undefined,
				hostParticipation,
				template: {
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
								.map((movement) => ({
									...movement,
									name: movement.name.trim(),
									notes: movement.notes?.trim() || undefined,
								}))
								.filter((movement) => movement.name.length > 0),
						})),
					})),
				},
			});
			onCreated(id);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save workout");
		} finally {
			setSaving(false);
		}
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
						{block.levels.map((level) => (
							<div
								key={level.level}
								className="mt-3 rounded-lg bg-[var(--surface-2)] p-3"
							>
								<p className="text-xs font-semibold text-[var(--accent)]">
									{level.label}
								</p>
								<input
									value={level.movements[0]?.name ?? ""}
									onChange={(event) =>
										setWodBlocks((prev) =>
											prev.map((item, itemIndex) =>
												itemIndex === index
													? {
															...item,
															levels: item.levels.map((entry) =>
																entry.level === level.level
																	? {
																			...entry,
																			movements: [
																				{
																					...(entry.movements[0] ?? {}),
																					name: event.target.value,
																				},
																			],
																		}
																	: entry,
															),
														}
													: item,
											),
										)
									}
									className="mt-2 h-9 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 text-xs text-white placeholder:text-[var(--text-muted)]"
									placeholder={`${level.label} prescription`}
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
				<Save size={15} /> {saving ? "Saving..." : "Save draft"}
			</button>
		</form>
	);
}
