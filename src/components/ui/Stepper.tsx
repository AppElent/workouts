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

	return (
		<div className="flex items-center gap-3">
			<span className="text-xs text-text-muted uppercase tracking-wide w-12 shrink-0">
				{label}
			</span>
			<div className="flex items-stretch flex-1 h-14 bg-surface-2 rounded-xl border border-border">
				<button
					type="button"
					onClick={dec}
					className="w-14 flex items-center justify-center text-text-muted hover:text-text hover:bg-text/5 active:bg-text/10 transition-colors touch-manipulation rounded-l-xl"
					aria-label={`Decrease ${label}`}
				>
					<Minus size={18} />
				</button>
				<div className="flex-1 flex items-center justify-center gap-1.5 select-none">
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
					className="w-14 flex items-center justify-center text-text-muted hover:text-text hover:bg-text/5 active:bg-text/10 transition-colors touch-manipulation rounded-r-xl"
					aria-label={`Increase ${label}`}
				>
					<Plus size={18} />
				</button>
			</div>
		</div>
	);
}
