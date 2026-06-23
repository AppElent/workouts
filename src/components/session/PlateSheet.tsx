import { X } from "lucide-react";
import { useEffect } from "react";
import {
	calcPlates,
	DEFAULT_BAR,
	generateWarmup,
	type Unit,
} from "#/lib/plates";

interface Props {
	weight: number;
	unit: Unit;
	exerciseName: string;
	onClose: () => void;
}

// Plate colors loosely follow IWF/standard gym conventions for quick scanning.
const PLATE_COLOR: Record<number, string> = {
	25: "#ef4444",
	20: "#3b82f6",
	15: "#eab308",
	10: "#22c55e",
	5: "#e5e7eb",
	2.5: "#9ca3af",
	1.25: "#6b7280",
	45: "#3b82f6",
	35: "#eab308",
};

export function PlateSheet({ weight, unit, exerciseName, onClose }: Props) {
	const bar = DEFAULT_BAR[unit];
	const plates = calcPlates(weight, bar, unit);
	const warmup = generateWarmup(weight, bar, unit);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		const { body } = document;
		const prev = body.style.overflow;
		body.style.overflow = "hidden";
		return () => {
			window.removeEventListener("keydown", onKey);
			body.style.overflow = prev;
		};
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
			role="dialog"
			aria-modal="true"
			aria-label="Plate calculator"
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop only — keyboard close via Esc */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop only — keyboard close via Esc */}
			<div onClick={onClose} className="absolute inset-0 bg-black/70" />
			<div className="relative w-full sm:max-w-md sm:mx-4 bg-[var(--surface)] border border-[var(--border)] rounded-t-2xl sm:rounded-2xl p-4 shadow-[0_-20px_50px_rgba(0,0,0,0.6)] max-h-[85vh] overflow-y-auto">
				<div className="flex items-baseline justify-between mb-4">
					<div>
						<div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--accent)]">
							Plates · {bar}
							{unit} bar
						</div>
						<div className="text-base font-bold text-white mt-0.5">
							{weight} {unit} · {exerciseName}
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1.5 text-[var(--text-muted)] hover:text-white transition-colors"
						aria-label="Close"
					>
						<X size={20} />
					</button>
				</div>

				{/* Plate breakdown */}
				{plates.belowBar ? (
					<p className="text-sm text-[var(--text-muted)] py-4 text-center">
						{weight} {unit} is at or below the empty bar ({bar} {unit}).
					</p>
				) : (
					<div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-4">
						<p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-3">
							Per side
						</p>
						{plates.perSide.length > 0 ? (
							<div className="flex items-end justify-center gap-1.5 min-h-[64px]">
								{/* bar stub */}
								<div className="h-2 w-6 bg-[var(--border-strong)] rounded-l self-center" />
								{plates.perSide.map((p, i) => (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: static plate list, duplicate values need index
										key={`${p}-${i}`}
										className="flex flex-col items-center justify-center rounded-sm text-[10px] font-bold text-black"
										style={{
											background: PLATE_COLOR[p] ?? "#9ca3af",
											height: `${Math.max(28, Math.min(64, 20 + p * 1.6))}px`,
											width: "22px",
										}}
									>
										{p}
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-[var(--text-muted)] text-center">
								Just the bar.
							</p>
						)}
						<p className="text-center text-xs text-[var(--text-muted)] mt-3">
							{plates.perSide.length > 0
								? `${plates.perSide.join(" + ")} ${unit} each side`
								: ""}
						</p>
						{plates.remainder > 0 && (
							<p className="text-center text-xs text-[var(--warn)] mt-1">
								{plates.remainder} {unit} can't be loaded with standard plates.
							</p>
						)}
					</div>
				)}

				{/* Warmup ramp */}
				{warmup.length > 0 && (
					<div className="mt-4">
						<p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-2">
							Suggested warmup
						</p>
						<div className="flex flex-col gap-1.5">
							{warmup.map((s) => (
								<div
									key={s.pct === null ? "bar" : `${s.pct}-${s.weight}`}
									className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2"
								>
									<span className="text-sm font-semibold text-white tabular-nums">
										{s.weight} {unit}
										{s.pct !== null && (
											<span className="text-[var(--text-muted)] text-xs font-normal ml-1.5">
												{Math.round(s.pct * 100)}%
											</span>
										)}
									</span>
									<span className="text-xs text-[var(--text-muted)]">
										× {s.reps}
									</span>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
