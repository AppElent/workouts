import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Plus, X } from "lucide-react";
import { useState } from "react";

type WodType = Doc<"wods">["type"];

interface MovementDraft {
	id: string;
	name: string;
	reps: string;
	weight: string;
}

const TYPES: { value: WodType; label: string }[] = [
	{ value: "forTime", label: "For Time" },
	{ value: "amrap", label: "AMRAP" },
	{ value: "emom", label: "EMOM" },
	{ value: "load", label: "Load" },
];

function newMovement(): MovementDraft {
	return { id: crypto.randomUUID(), name: "", reps: "", weight: "" };
}

export function CreateWodForm() {
	const createWod = useMutation(api.wods.create);

	const [name, setName] = useState("");
	const [type, setType] = useState<WodType>("forTime");
	const [repScheme, setRepScheme] = useState("");
	const [minutes, setMinutes] = useState("");
	const [description, setDescription] = useState("");
	const [movements, setMovements] = useState<MovementDraft[]>([newMovement()]);

	function updateMovement(id: string, patch: Partial<MovementDraft>) {
		setMovements((prev) =>
			prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
		);
	}
	function addMovement() {
		setMovements((prev) => [...prev, newMovement()]);
	}
	function removeMovement(id: string) {
		setMovements((prev) => prev.filter((m) => m.id !== id));
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const cleanMovements = movements
			.filter((m) => m.name.trim())
			.map((m) => ({
				name: m.name.trim(),
				reps: m.reps ? Number(m.reps) : undefined,
				weight: m.weight ? Number(m.weight) : undefined,
				unit: m.weight ? ("kg" as const) : undefined,
			}));
		if (!name.trim() || cleanMovements.length === 0) return;
		const mins = minutes ? Number(minutes) : undefined;
		await createWod({
			name: name.trim(),
			type,
			repScheme: repScheme.trim() || undefined,
			description: description.trim() || undefined,
			timeCapSeconds: type === "forTime" && mins ? mins * 60 : undefined,
			durationSeconds:
				(type === "amrap" || type === "emom") && mins ? mins * 60 : undefined,
			movements: cleanMovements,
		});
		setName("");
		setType("forTime");
		setRepScheme("");
		setMinutes("");
		setDescription("");
		setMovements([newMovement()]);
	}

	const inputCls =
		"h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

	return (
		<form
			onSubmit={(e) => void handleSubmit(e)}
			className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 flex flex-col gap-4"
		>
			<h2 className="text-sm font-semibold text-white">Create WOD</h2>

			<input
				type="text"
				placeholder="WOD name (e.g. Monday Metcon)"
				value={name}
				onChange={(e) => setName(e.target.value)}
				className={inputCls}
				required
			/>

			<div className="flex gap-2">
				{TYPES.map((t) => (
					<button
						key={t.value}
						type="button"
						onClick={() => setType(t.value)}
						className={[
							"flex-1 h-9 rounded-lg text-xs font-medium transition-all",
							type === t.value
								? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/50"
								: "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] hover:text-white",
						].join(" ")}
					>
						{t.label}
					</button>
				))}
			</div>

			<div className="flex gap-2">
				<input
					type="text"
					placeholder="Rep scheme (e.g. 21-15-9)"
					value={repScheme}
					onChange={(e) => setRepScheme(e.target.value)}
					className={`${inputCls} flex-1`}
				/>
				{type !== "load" && (
					<input
						type="number"
						min="0"
						placeholder={
							type === "forTime" ? "Time cap (min)" : "Duration (min)"
						}
						value={minutes}
						onChange={(e) => setMinutes(e.target.value)}
						className={`${inputCls} w-36`}
					/>
				)}
			</div>

			<textarea
				placeholder="Description / notes (optional)"
				value={description}
				onChange={(e) => setDescription(e.target.value)}
				rows={2}
				className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
			/>

			<div className="flex flex-col gap-2">
				{movements.map((m) => (
					<div key={m.id} className="flex gap-2 items-center">
						<input
							type="text"
							placeholder="Movement"
							value={m.name}
							onChange={(e) => updateMovement(m.id, { name: e.target.value })}
							className={`${inputCls} flex-1`}
						/>
						<input
							type="number"
							placeholder="Reps"
							value={m.reps}
							onChange={(e) => updateMovement(m.id, { reps: e.target.value })}
							className={`${inputCls} w-20`}
						/>
						<input
							type="number"
							placeholder="kg"
							value={m.weight}
							onChange={(e) => updateMovement(m.id, { weight: e.target.value })}
							className={`${inputCls} w-20`}
						/>
						<button
							type="button"
							onClick={() => removeMovement(m.id)}
							className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors"
							aria-label="Remove movement"
						>
							<X size={14} />
						</button>
					</div>
				))}
				<button
					type="button"
					onClick={addMovement}
					className="flex items-center gap-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors self-start"
				>
					<Plus size={14} />
					Add Movement
				</button>
			</div>

			<div className="flex justify-end">
				<button
					type="submit"
					disabled={!name.trim()}
					className="px-5 py-2 rounded-full bg-[var(--accent)] text-black text-sm font-bold disabled:opacity-40 hover:bg-[var(--accent-hover)] transition-colors"
				>
					Save WOD
				</button>
			</div>
		</form>
	);
}
