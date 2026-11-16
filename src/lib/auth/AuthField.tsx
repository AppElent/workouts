import { useId } from "react";

export function AuthField({
	label,
	type,
	value,
	onChange,
	error,
	autoComplete,
	required,
}: {
	label: string;
	type: string;
	value: string;
	onChange: (value: string) => void;
	error?: string;
	autoComplete?: string;
	required?: boolean;
}) {
	const id = useId();
	const errorId = useId();
	return (
		<div className="flex flex-col gap-1">
			<label htmlFor={id} className="text-sm font-medium text-text">
				{label}
			</label>
			<input
				id={id}
				type={type}
				value={value}
				required={required}
				autoComplete={autoComplete}
				aria-describedby={error ? errorId : undefined}
				onChange={(e) => onChange(e.target.value)}
				className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent-ink"
			/>
			{error ? (
				<p id={errorId} className="text-xs text-danger">
					{error}
				</p>
			) : null}
		</div>
	);
}
