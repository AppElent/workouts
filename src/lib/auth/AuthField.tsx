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
			<label htmlFor={id} className="text-sm font-medium text-[var(--auth-fg)]">
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
				className="rounded-[var(--auth-radius)] border border-[var(--auth-border)] bg-[var(--auth-field-bg)] px-3 py-2 text-sm text-[var(--auth-fg)] outline-none focus:border-[var(--auth-accent)]"
			/>
			{error ? (
				<p id={errorId} className="text-xs text-[var(--auth-error)]">
					{error}
				</p>
			) : null}
		</div>
	);
}
