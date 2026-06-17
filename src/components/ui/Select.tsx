import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "#/lib/utils";

export interface SelectOption {
	value: string;
	label: string;
}

interface Props {
	/** Selected value. Empty string means "no filter" (shows the placeholder). */
	value: string;
	onValueChange: (value: string) => void;
	placeholder: string;
	/** Label for the reset / "show all" item at the top of the list. */
	allLabel: string;
	options: ReadonlyArray<SelectOption>;
	className?: string;
	"aria-label"?: string;
}

/**
 * App-themed dropdown built on Base UI's Select primitive. Replaces native
 * <select> so filters match the rest of the dark UI. Empty string is treated
 * as "no selection" and renders the placeholder in the trigger.
 */
export function Select({
	value,
	onValueChange,
	placeholder,
	allLabel,
	options,
	className,
	"aria-label": ariaLabel,
}: Props) {
	const items: Record<string, React.ReactNode> = {};
	for (const o of options) items[o.value] = o.label;

	return (
		<BaseSelect.Root
			items={items}
			value={value === "" ? null : value}
			onValueChange={(v) => onValueChange(v == null ? "" : String(v))}
		>
			<BaseSelect.Trigger
				aria-label={ariaLabel}
				className={cn(
					"flex items-center justify-between gap-2 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-[11px] text-[var(--text-muted)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] data-[popup-open]:ring-1 data-[popup-open]:ring-[var(--accent)]",
					className,
				)}
			>
				<BaseSelect.Value placeholder={placeholder} />
				<BaseSelect.Icon className="shrink-0 text-[var(--text-muted)]">
					<ChevronDown size={14} />
				</BaseSelect.Icon>
			</BaseSelect.Trigger>
			<BaseSelect.Portal>
				<BaseSelect.Positioner sideOffset={4} className="z-50">
					<BaseSelect.Popup className="min-w-[var(--anchor-width)] max-h-[var(--available-height)] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-overlay)] outline-none">
						<BaseSelect.Item
							value={null}
							className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[12px] text-[var(--text-muted)] data-[highlighted]:bg-[var(--surface-2)] data-[highlighted]:text-white cursor-pointer select-none outline-none"
						>
							<BaseSelect.ItemText>{allLabel}</BaseSelect.ItemText>
						</BaseSelect.Item>
						{options.map((o) => (
							<BaseSelect.Item
								key={o.value}
								value={o.value}
								className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[12px] text-[var(--text-muted)] data-[highlighted]:bg-[var(--surface-2)] data-[highlighted]:text-white data-[selected]:text-white cursor-pointer select-none outline-none"
							>
								<BaseSelect.ItemText>{o.label}</BaseSelect.ItemText>
								<BaseSelect.ItemIndicator className="shrink-0">
									<Check size={14} className="text-[var(--accent)]" />
								</BaseSelect.ItemIndicator>
							</BaseSelect.Item>
						))}
					</BaseSelect.Popup>
				</BaseSelect.Positioner>
			</BaseSelect.Portal>
		</BaseSelect.Root>
	);
}
