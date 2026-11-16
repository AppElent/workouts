import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Loader2 } from "lucide-react";

import { cn } from "#/lib/utils";

const VARIANTS = {
	default: "bg-accent-fill font-bold text-on-accent hover:bg-accent-pressed",
	outline: "border-border-strong text-text hover:bg-surface-2",
	ghost: "text-text-muted hover:bg-surface-2 hover:text-text",
	destructive: "bg-danger-soft text-danger hover:bg-danger/20",
} as const;

function Button({
	className,
	variant = "default",
	loading = false,
	disabled,
	children,
	...props
}: ButtonPrimitive.Props & {
	variant?: keyof typeof VARIANTS;
	loading?: boolean;
}) {
	return (
		<ButtonPrimitive
			data-slot="button"
			disabled={disabled || loading}
			className={cn(
				"inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-accent-ink/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
				VARIANTS[variant],
				className,
			)}
			{...props}
		>
			{loading && <Loader2 aria-hidden="true" className="animate-spin" />}
			{children}
		</ButtonPrimitive>
	);
}

export { Button };
