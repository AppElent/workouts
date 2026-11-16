import { useMessages } from "#/lib/i18n";
import { cn } from "#/lib/utils";

export function AuthButton({
	children,
	loading,
	disabled,
	variant = "primary",
	type = "submit",
	onClick,
	className,
}: {
	children: React.ReactNode;
	loading?: boolean;
	disabled?: boolean;
	variant?: "primary" | "ghost";
	type?: "submit" | "button";
	onClick?: () => void;
	className?: string;
}) {
	const { auth } = useMessages();
	return (
		<button
			type={type}
			disabled={loading || disabled}
			aria-busy={loading ?? false}
			onClick={onClick}
			className={cn(
				"inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-60",
				variant === "primary"
					? "bg-accent-fill text-on-accent hover:opacity-90"
					: "border border-dashed border-accent-ink text-text hover:bg-border",
				className,
			)}
		>
			{loading ? auth.wait : children}
		</button>
	);
}
