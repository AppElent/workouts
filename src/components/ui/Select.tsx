import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "#/lib/utils";

interface SelectOption {
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

/** Base UI's Select instead of a native <select>, so filters match the dark UI. */
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
					"flex items-center justify-between gap-2 h-8 rounded-lg border border-border bg-surface px-2 text-eyebrow text-text-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-ink data-[popup-open]:ring-1 data-[popup-open]:ring-accent-ink",
					className,
				)}
			>
				<BaseSelect.Value placeholder={placeholder} />
				<BaseSelect.Icon className="shrink-0 text-text-muted">
					<ChevronDown size={14} />
				</BaseSelect.Icon>
			</BaseSelect.Trigger>
			<BaseSelect.Portal>
				<BaseSelect.Positioner sideOffset={4} className="z-50">
					<BaseSelect.Popup className="min-w-[var(--anchor-width)] max-h-[var(--available-height)] overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-overlay outline-none">
						<BaseSelect.Item
							value={null}
							className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-caption text-text-muted data-[highlighted]:bg-surface-2 data-[highlighted]:text-text cursor-pointer select-none outline-none"
						>
							<BaseSelect.ItemText>{allLabel}</BaseSelect.ItemText>
						</BaseSelect.Item>
						{options.map((o) => (
							<BaseSelect.Item
								key={o.value}
								value={o.value}
								className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-caption text-text-muted data-[highlighted]:bg-surface-2 data-[highlighted]:text-text data-[selected]:text-text cursor-pointer select-none outline-none"
							>
								<BaseSelect.ItemText>{o.label}</BaseSelect.ItemText>
								<BaseSelect.ItemIndicator className="shrink-0">
									<Check size={14} className="text-accent-ink" />
								</BaseSelect.ItemIndicator>
							</BaseSelect.Item>
						))}
					</BaseSelect.Popup>
				</BaseSelect.Positioner>
			</BaseSelect.Portal>
		</BaseSelect.Root>
	);
}
