import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Copy, Minus, Plus, Trash2, X } from "lucide-react";
import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from "react";

type SetType = Doc<"sets">["setType"];
type Unit = Doc<"sets">["unit"];

interface Props {
	set: Doc<"sets"> | null;
	exerciseName: string;
	weightStep: number;
	onClose: () => void;
}

interface Draft {
	weight: number;
	reps: number;
	rpe: number | undefined;
	setType: SetType;
	unit: Unit;
}

const TYPE_OPTIONS: Array<{ value: SetType; label: string; color: string }> = [
	{ value: "warmup", label: "Warmup", color: "var(--text-muted)" },
	{ value: "working", label: "Working", color: "var(--accent)" },
	{ value: "drop", label: "Drop", color: "#fbbf24" },
	{ value: "failure", label: "Failure", color: "#f87171" },
];

const RPE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const DRAG_DISMISS_THRESHOLD = 120;

function toDraft(set: Doc<"sets">): Draft {
	return {
		weight: set.weight,
		reps: set.reps,
		rpe: set.rpe,
		setType: set.setType,
		unit: set.unit,
	};
}

function isDirty(set: Doc<"sets">, d: Draft) {
	return (
		set.weight !== d.weight ||
		set.reps !== d.reps ||
		set.rpe !== d.rpe ||
		set.setType !== d.setType ||
		set.unit !== d.unit
	);
}

export function SetEditSheet({ set, exerciseName, weightStep, onClose }: Props) {
	const updateSet = useMutation(api.sets.update);
	const removeSet = useMutation(api.sets.remove);
	const duplicateSet = useMutation(api.sets.duplicate);

	const [draft, setDraft] = useState<Draft | null>(null);
	const [confirmingDiscard, setConfirmingDiscard] = useState(false);
	const [dragY, setDragY] = useState(0);
	const [dragging, setDragging] = useState(false);
	const dragStartRef = useRef<{ y: number; t: number } | null>(null);
	const lastMoveRef = useRef<{ y: number; t: number } | null>(null);
	const panelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (set) {
			setDraft(toDraft(set));
			setConfirmingDiscard(false);
			setDragY(0);
		}
	}, [set]);

	const dirty = !!set && !!draft && isDirty(set, draft);

	const requestClose = () => {
		if (dirty) {
			setConfirmingDiscard(true);
			return;
		}
		onClose();
	};

	useEffect(() => {
		if (!set) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") requestClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
		// biome-ignore lint/correctness/useExhaustiveDependencies: requestClose reads latest dirty/draft via closure refresh
	}, [set, dirty]);

	if (!set || !draft) return null;

	const inc = weightStep;
	const weightJumps = [-inc * 4, -inc * 2, +inc * 2, +inc * 4];
	const repsJumps = [-2, -1, +1, +2];

	const update = (patch: Partial<Draft>) =>
		setDraft((d) => (d ? { ...d, ...patch } : d));

	const handleSave = async () => {
		if (!set || !draft) return;
		await updateSet({
			id: set._id,
			weight: draft.weight,
			reps: draft.reps,
			rpe: draft.rpe,
			setType: draft.setType,
			unit: draft.unit,
		});
		onClose();
	};

	const handleDelete = async () => {
		await removeSet({ id: set._id });
		onClose();
	};

	const handleDuplicate = async () => {
		await duplicateSet({ id: set._id });
		onClose();
	};

	const onDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (typeof window === "undefined") return;
		if (!window.matchMedia("(max-width: 639px)").matches) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		const now = performance.now();
		dragStartRef.current = { y: e.clientY, t: now };
		lastMoveRef.current = { y: e.clientY, t: now };
		setDragging(true);
	};

	const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (!dragging || !dragStartRef.current) return;
		const dy = Math.max(0, e.clientY - dragStartRef.current.y);
		setDragY(dy);
		lastMoveRef.current = { y: e.clientY, t: performance.now() };
	};

	const onDragEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (!dragging || !dragStartRef.current) return;
		(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
		const start = dragStartRef.current;
		const last = lastMoveRef.current ?? start;
		const dy = Math.max(0, last.y - start.y);
		const dt = Math.max(1, last.t - start.t);
		const velocity = dy / dt;
		setDragging(false);
		dragStartRef.current = null;
		lastMoveRef.current = null;
		if (dy > DRAG_DISMISS_THRESHOLD || velocity > 0.5) {
			setDragY(0);
			requestClose();
		} else {
			setDragY(0);
		}
	};

	const backdropOpacity = Math.max(0, 1 - dragY / 400);

	return (
		<div
			className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
			role="dialog"
			aria-modal="true"
			aria-label={`Edit set ${set.setNumber}`}
		>
			{/** biome-ignore lint/a11y/useKeyWithClickEvents: backdrop only — keyboard close via Esc */}
			<div
				onClick={requestClose}
				className="absolute inset-0 bg-black/70"
				style={{ opacity: backdropOpacity }}
			/>
			<div
				ref={panelRef}
				className="relative w-full sm:max-w-md sm:mx-4 bg-[var(--surface)] border border-[var(--border)] rounded-t-2xl sm:rounded-2xl p-4 shadow-[0_-20px_50px_rgba(0,0,0,0.6)]"
				style={{
					transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
					transition: dragging ? "none" : "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
					touchAction: dragging ? "none" : undefined,
				}}
			>
				{/* Drag handle (mobile only) */}
				<div
					onPointerDown={onDragStart}
					onPointerMove={onDragMove}
					onPointerUp={onDragEnd}
					onPointerCancel={onDragEnd}
					className="sm:hidden -mx-4 -mt-4 px-4 pt-3 pb-2 cursor-grab active:cursor-grabbing"
					style={{ touchAction: "none" }}
				>
					<div className="mx-auto w-9 h-1 rounded-full bg-[var(--border-strong)]" />
				</div>

				{/* Header */}
				<div
					onPointerDown={onDragStart}
					onPointerMove={onDragMove}
					onPointerUp={onDragEnd}
					onPointerCancel={onDragEnd}
					className="flex items-baseline justify-between mb-4 sm:cursor-default"
					style={{ touchAction: "pan-y" }}
				>
					<div>
						<div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--accent)]">
							Set {set.setNumber}
						</div>
						<div className="text-base font-bold text-white mt-0.5">
							{exerciseName}
						</div>
					</div>
					<button
						type="button"
						onClick={requestClose}
						className="p-1.5 text-[var(--text-muted)] hover:text-white transition-colors"
						aria-label="Close"
					>
						<X size={20} />
					</button>
				</div>

				{/* Weight */}
				<div className="mb-3.5">
					<div className="flex items-baseline justify-between mb-1.5">
						<span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
							Weight · {draft.unit}
						</span>
						<span className="text-[9px] uppercase tracking-[0.05em] text-[var(--text-faint)]">
							step {inc}
						</span>
					</div>
					<BigStepper
						value={draft.weight}
						step={inc}
						min={0}
						quickJumps={weightJumps}
						onChange={(v) => update({ weight: v })}
					/>
				</div>

				{/* Reps */}
				<div className="mb-3.5">
					<div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)] mb-1.5">
						Reps
					</div>
					<BigStepper
						value={draft.reps}
						step={1}
						min={1}
						quickJumps={repsJumps}
						onChange={(v) => update({ reps: v })}
					/>
				</div>

				{/* RPE */}
				<div className="mb-3.5">
					<div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)] mb-1.5">
						RPE
					</div>
					<div className="flex gap-1">
						{RPE_OPTIONS.map((v) => {
							const sel = draft.rpe === v;
							return (
								<button
									key={v}
									type="button"
									onClick={() => update({ rpe: v })}
									className={[
										"flex-1 h-9 rounded-lg text-xs font-semibold border transition-colors",
										sel
											? "bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent-ring)]"
											: "bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]",
									].join(" ")}
								>
									{v}
								</button>
							);
						})}
					</div>
				</div>

				{/* Type */}
				<div className="mb-4">
					<div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)] mb-1.5">
						Type
					</div>
					<div className="grid grid-cols-4 gap-1">
						{TYPE_OPTIONS.map((o) => {
							const sel = draft.setType === o.value;
							return (
								<button
									key={o.value}
									type="button"
									onClick={() => update({ setType: o.value })}
									className="h-10 rounded-lg text-[11px] font-semibold border transition-colors"
									style={{
										background: sel
											? `color-mix(in srgb, ${o.color} 13%, transparent)`
											: "var(--surface-2)",
										color: sel ? o.color : "var(--text-muted)",
										borderColor: sel
											? `color-mix(in srgb, ${o.color} 33%, transparent)`
											: "var(--border)",
									}}
								>
									{o.label}
								</button>
							);
						})}
					</div>
				</div>

				{/* Footer */}
				{confirmingDiscard ? (
					<div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
						<span className="text-xs text-white">Discard unsaved changes?</span>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => setConfirmingDiscard(false)}
								className="px-3 py-1.5 rounded-md text-xs font-semibold text-[var(--text-muted)] hover:text-white transition-colors"
							>
								Keep editing
							</button>
							<button
								type="button"
								onClick={() => {
									setConfirmingDiscard(false);
									onClose();
								}}
								className="px-3 py-1.5 rounded-md bg-[var(--danger-soft)] text-[var(--danger)] text-xs font-semibold"
							>
								Discard
							</button>
						</div>
					</div>
				) : (
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => void handleDelete()}
							className="flex items-center gap-1.5 px-3.5 py-3 rounded-lg bg-[var(--danger-soft)] text-[var(--danger)] text-[13px] font-semibold"
						>
							<Trash2 size={14} />
							Delete
						</button>
						<button
							type="button"
							onClick={() => void handleDuplicate()}
							className="flex items-center gap-1.5 px-3.5 py-3 rounded-lg bg-[var(--surface-2)] text-white text-[13px] font-semibold border border-[var(--border)]"
						>
							<Copy size={14} />
							Duplicate
						</button>
						<button
							type="button"
							onClick={() => void handleSave()}
							disabled={!dirty}
							className="flex-1 px-4 py-3 rounded-lg bg-[var(--accent)] text-black text-[13px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Save
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

interface BigStepperProps {
	value: number;
	step: number;
	min?: number;
	quickJumps: number[];
	onChange: (v: number) => void;
}

function BigStepper({ value, step, min = 0, quickJumps, onChange }: BigStepperProps) {
	const clamp = (v: number) => Math.max(min, +v.toFixed(2));
	return (
		<div>
			<div className="flex items-center bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl h-16 overflow-hidden">
				<button
					type="button"
					onClick={() => onChange(clamp(value - step))}
					className="w-16 h-full grid place-items-center text-white active:bg-white/5"
					aria-label="Decrease"
				>
					<Minus size={22} strokeWidth={2.5} />
				</button>
				<div className="flex-1 h-full grid place-items-center text-3xl font-extrabold text-white tabular-nums tracking-tight">
					{value}
				</div>
				<button
					type="button"
					onClick={() => onChange(clamp(value + step))}
					className="w-16 h-full grid place-items-center text-white active:bg-white/5"
					aria-label="Increase"
				>
					<Plus size={22} strokeWidth={2.5} />
				</button>
			</div>
			<div className="flex gap-1.5 mt-2">
				{quickJumps.map((j) => (
					<button
						key={j}
						type="button"
						onClick={() => onChange(clamp(value + j))}
						className={[
							"flex-1 h-8 rounded-lg text-xs font-bold tabular-nums bg-[var(--surface-2)] border border-[var(--border)]",
							j > 0 ? "text-[var(--accent)]" : "text-[var(--text-muted)]",
						].join(" ")}
					>
						{j > 0 ? `+${j}` : j}
					</button>
				))}
			</div>
		</div>
	);
}
