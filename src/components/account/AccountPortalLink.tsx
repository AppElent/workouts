import { ACCOUNT_PORTAL_URL } from "@foundry/core";
import { ExternalLink } from "lucide-react";
import { useMessages } from "#/lib/i18n";

/** Opens the AppElent account portal, where the full shared account lives. */
export function AccountPortalLink() {
	const text = useMessages().account.portal;
	return (
		<section className="group relative rounded-xl border border-border bg-surface p-4 has-focus-visible:ring-3 has-focus-visible:ring-accent-ink/40">
			<div className="flex items-center justify-between gap-3">
				{/* The link stretches over the card, so the whole card is its hit area. */}
				<a
					href={ACCOUNT_PORTAL_URL}
					target="_blank"
					rel="noopener noreferrer"
					className="text-sm font-semibold text-text outline-none after:absolute after:inset-0 after:rounded-xl group-hover:text-accent-ink"
				>
					{text.label}
				</a>
				<ExternalLink
					size={16}
					aria-hidden
					className="shrink-0 text-text-muted group-hover:text-accent-ink"
				/>
			</div>
			<p className="mt-1 text-xs text-text-muted">{text.footer}</p>
		</section>
	);
}
