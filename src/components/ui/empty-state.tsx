import type { LucideIcon } from "lucide-react";
import { cn } from "#/lib/utils";

interface EmptyStateProps {
	icon?: LucideIcon;
	title: string;
	description?: string;
	action?: React.ReactNode;
	className?: string;
}

/** Every empty data view uses this; never leave one as an unexplained blank. */
export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] px-6 py-12 text-center",
				className,
			)}
		>
			{Icon && (
				<Icon
					size={24}
					aria-hidden="true"
					className="text-[var(--text-muted)]"
				/>
			)}
			<p className="text-sm font-semibold text-white">{title}</p>
			{description && (
				<p className="max-w-sm text-sm text-[var(--text-muted)]">
					{description}
				</p>
			)}
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
}
