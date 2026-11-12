import { createFileRoute, Link } from "@tanstack/react-router";
import { useMessages } from "#/lib/i18n";

// Public page: the App Store listing links here as the support URL, so it must
// render without sign-in.
export const Route = createFileRoute("/support")({
	head: () => ({ meta: [{ title: "Support — Foundry" }] }),
	component: SupportPage,
});

function SupportPage() {
	const { support: copy } = useMessages();
	return (
		<main className="min-h-screen px-6 py-12 sm:py-16">
			<article className="mx-auto max-w-2xl flex flex-col gap-8 text-sm leading-relaxed text-[var(--text-muted)]">
				<header className="flex flex-col gap-2">
					<Link to="/" className="text-xs text-[var(--accent)]">
						← {copy.back}
					</Link>
					<h1 className="text-3xl font-bold text-white">{copy.title}</h1>
				</header>
				<section className="flex flex-col gap-3">
					<p>{copy.intro}</p>
					<a
						href="mailto:privacy@appelent.nl?subject=Foundry%20support"
						className="text-[var(--accent)]"
					>
						{copy.contactLabel}
					</a>
				</section>
				<section className="flex flex-col gap-4">
					<h2 className="text-lg font-semibold text-white">{copy.faq.title}</h2>
					{Object.entries(copy.faq.items).map(([key, { q, a }]) => (
						<div key={key} className="flex flex-col gap-1">
							<h3 className="font-semibold text-white">{q}</h3>
							<p>{a}</p>
						</div>
					))}
				</section>
				<Link to="/privacy" className="text-xs text-[var(--accent)]">
					{copy.privacyLink}
				</Link>
			</article>
		</main>
	);
}
