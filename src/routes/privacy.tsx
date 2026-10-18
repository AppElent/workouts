import { createFileRoute, Link } from "@tanstack/react-router";
import { useMessages } from "#/lib/i18n";

// Public page: the mobile app and store listings link here, so it must render
// without sign-in.
export const Route = createFileRoute("/privacy")({
	head: () => ({ meta: [{ title: "Privacy statement — Foundry" }] }),
	component: PrivacyPage,
});

function PrivacyPage() {
	const { privacy: copy } = useMessages();
	const textSections = [copy.security, copy.children, copy.changes];
	return (
		<main className="min-h-screen px-6 py-12 sm:py-16">
			<article className="mx-auto max-w-2xl flex flex-col gap-8 text-sm leading-relaxed text-[var(--text-muted)]">
				<header className="flex flex-col gap-2">
					<Link to="/" className="text-xs text-[var(--accent)]">
						← {copy.back}
					</Link>
					<h1 className="text-3xl font-bold text-white">{copy.title}</h1>
					<p className="text-xs">{copy.updated}</p>
				</header>
				<Section title={copy.intro.title}>
					<Paragraphs body={copy.intro.body} />
				</Section>
				<Section title={copy.collect.title}>
					<List items={copy.collect.items} />
				</Section>
				<Section title={copy.purposes.title}>
					<Paragraphs body={copy.purposes.body} />
				</Section>
				<Section title={copy.providers.title}>
					<p>{copy.providers.intro}</p>
					<List items={copy.providers.items} />
					<p>{copy.providers.signIn}</p>
					<p>{copy.providers.openFoodFacts}</p>
					<p>{copy.providers.transfers}</p>
				</Section>
				<Section title={copy.retention.title}>
					<Paragraphs body={copy.retention.body} />
				</Section>
				<Section title={copy.rights.title}>
					<Paragraphs body={copy.rights.body} />
				</Section>
				{textSections.map(({ title, body }) => (
					<Section key={title} title={title}>
						<p>{body}</p>
					</Section>
				))}
			</article>
		</main>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="flex flex-col gap-3">
			<h2 className="text-lg font-semibold text-white">{title}</h2>
			{children}
		</section>
	);
}

function Paragraphs({ body }: { body: Record<string, string> }) {
	return Object.entries(body).map(([key, text]) => <p key={key}>{text}</p>);
}

function List({ items }: { items: Record<string, string> }) {
	return (
		<ul className="list-disc pl-5 flex flex-col gap-1.5">
			{Object.entries(items).map(([key, text]) => (
				<li key={key}>{text}</li>
			))}
		</ul>
	);
}
