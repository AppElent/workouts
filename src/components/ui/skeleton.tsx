import { cn } from "#/lib/utils";

/**
 * Loading placeholder block. Compose per-view skeletons that match the final
 * layout (same heights/widths as the loaded content) so nothing shifts when
 * data arrives.
 */
export function Skeleton({ className }: { className?: string }) {
	return (
		<div
			aria-hidden="true"
			className={cn("animate-pulse rounded-md bg-white/10", className)}
		/>
	);
}
