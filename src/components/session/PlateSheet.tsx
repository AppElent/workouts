import {
	calcPlates,
	DEFAULT_BAR,
	generateWarmup,
	type LoadUnit,
} from "@foundry/core";
import { Modal, ModalCloseButton, ModalTitle } from "#/components/ui/Modal";

interface Props {
	open: boolean;
	weight: number;
	unit: LoadUnit;
	exerciseName: string;
	onClose: () => void;
}

// Plate colors loosely follow IWF/standard gym conventions for quick scanning.
// The plate-* tokens live in src/styles.css.
const PLATE_COLOR: Record<number, string> = {
	25: "bg-plate-red",
	20: "bg-plate-blue",
	15: "bg-plate-yellow",
	10: "bg-plate-green",
	5: "bg-plate-white",
	2.5: "bg-plate-silver",
	1.25: "bg-plate-silver",
	45: "bg-plate-blue",
	35: "bg-plate-yellow",
};

export function PlateSheet({
	open,
	weight,
	unit,
	exerciseName,
	onClose,
}: Props) {
	const bar = DEFAULT_BAR[unit];
	const plates = calcPlates(weight, bar, unit);
	const warmup = generateWarmup(weight, bar, unit);

	return (
		<Modal
			open={open}
			onOpenChange={(next) => !next && onClose()}
			className="p-4"
		>
			<div className="flex items-baseline justify-between mb-4">
				<div>
					<ModalTitle className="text-micro font-bold uppercase tracking-[0.1em] text-accent-ink">
						Plates · {bar}
						{unit} bar
					</ModalTitle>
					<div className="text-base font-bold text-text mt-0.5">
						{weight} {unit} · {exerciseName}
					</div>
				</div>
				<ModalCloseButton />
			</div>

			{plates.belowBar ? (
				<p className="text-sm text-text-muted py-4 text-center">
					{weight} {unit} is at or below the empty bar ({bar} {unit}).
				</p>
			) : (
				<div className="rounded-xl bg-surface-2 border border-border p-4">
					<p className="text-micro uppercase tracking-wide text-text-muted mb-3">
						Per side
					</p>
					{plates.perSide.length > 0 ? (
						<div className="flex items-end justify-center gap-1.5 min-h-[64px]">
							<div className="h-2 w-6 bg-border-strong rounded-l self-center" />
							{plates.perSide.map((p, i) => (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: static plate list, duplicate values need index
									key={`${p}-${i}`}
									className={`flex flex-col items-center justify-center rounded-sm text-micro font-bold text-on-plate ${PLATE_COLOR[p] ?? "bg-plate-silver"}`}
									style={{
										height: `${Math.max(28, Math.min(64, 20 + p * 1.6))}px`,
										width: "22px",
									}}
								>
									{p}
								</div>
							))}
						</div>
					) : (
						<p className="text-sm text-text-muted text-center">Just the bar.</p>
					)}
					<p className="text-center text-xs text-text-muted mt-3">
						{plates.perSide.length > 0
							? `${plates.perSide.join(" + ")} ${unit} each side`
							: ""}
					</p>
					{plates.remainder > 0 && (
						<p className="text-center text-xs text-warn mt-1">
							{plates.remainder} {unit} can't be loaded with standard plates.
						</p>
					)}
				</div>
			)}

			{warmup.length > 0 && (
				<div className="mt-4">
					<p className="text-micro uppercase tracking-wide text-text-muted mb-2">
						Suggested warmup
					</p>
					<div className="flex flex-col gap-1.5">
						{warmup.map((s) => (
							<div
								key={s.pct === null ? "bar" : `${s.pct}-${s.weight}`}
								className="flex items-center justify-between rounded-lg bg-surface-2 border border-border px-3 py-2"
							>
								<span className="text-sm font-semibold text-text tabular-nums">
									{s.weight} {unit}
									{s.pct !== null && (
										<span className="text-text-muted text-xs font-normal ml-1.5">
											{Math.round(s.pct * 100)}%
										</span>
									)}
								</span>
								<span className="text-xs text-text-muted">× {s.reps}</span>
							</div>
						))}
					</div>
				</div>
			)}
		</Modal>
	);
}
