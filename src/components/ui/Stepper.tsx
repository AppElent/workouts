import { Minus, Plus } from "lucide-react";

export interface StepperProps {
	value: number;
	onChange: (v: number) => void;
	min?: number;
	max?: number;
	step?: number;
	unit?: string;
	label: string;
}

export function Stepper({
	value,
	onChange,
	min = 0,
	max = 9999,
	step = 1,
	unit,
	label,
}: StepperProps) {
	const dec = () =>
		onChange(Math.max(min, parseFloat((value - step).toFixed(2))));
	const inc = () =>
		onChange(Math.min(max, parseFloat((value + step).toFixed(2))));

	// The w-16 label column fits the longest one-word label (EN "Seconds", NL
	// "Gewicht") with a visible gap; longer labels such as "Added weight" wrap
	// at the space. On phones the 44px buttons leave room for "102.5 kg" at 320px.
	return (
		<div className="flex items-center gap-2">
			<span className="w-16 shrink-0 break-words text-xs uppercase leading-tight tracking-wide text-text-muted">
				{label}
			</span>
			<div className="flex min-w-0 items-stretch flex-1 h-14 bg-surface-2 rounded-xl border border-border">
				<button
					type="button"
					onClick={dec}
					className="w-11 sm:w-14 shrink-0 flex items-center justify-center text-text-muted hover:text-text hover:bg-text/5 active:bg-text/10 transition-colors touch-manipulation rounded-l-xl"
					aria-label={`Decrease ${label}`}
				>
					<Minus size={18} />
				</button>
				<div className="min-w-0 flex-1 flex items-center justify-center gap-1 select-none">
					<span className="text-stat font-bold text-text leading-none tabular-nums">
						{value}
					</span>
					{unit && (
						<span className="text-xs text-text-muted uppercase tracking-wide">
							{unit}
						</span>
					)}
				</div>
				<button
					type="button"
					onClick={inc}
					className="w-11 sm:w-14 shrink-0 flex items-center justify-center text-text-muted hover:text-text hover:bg-text/5 active:bg-text/10 transition-colors touch-manipulation rounded-r-xl"
					aria-label={`Increase ${label}`}
				>
					<Plus size={18} />
				</button>
			</div>
		</div>
	);
}
