import { createFileRoute, Link } from "@tanstack/react-router";
import { DeleteAccountCard } from "#/components/account/DeleteAccountCard";
import { ExportDataCard } from "#/components/account/ExportDataCard";
import { ReportProblem } from "#/components/account/ReportProblem";
import { TestDataCard } from "#/components/account/TestDataCard";
import { ProfilePanel } from "#/lib/auth/ProfilePanel";
import { useMessages } from "#/lib/i18n";
import { pageTitle } from "#/lib/i18n/head";

export const Route = createFileRoute("/_app/_authed/account/")({
	ssr: false,
	head: ({ matches }) => ({
		meta: [pageTitle(matches, (messages) => messages.nav.profile.label)],
	}),
	component: AccountPage,
});

function AccountPage() {
	const { nav, privacy } = useMessages();
	return (
		<div className="p-4 sm:p-6 max-w-4xl mx-auto flex flex-col gap-6">
			<h1 className="text-2xl font-bold text-text">{nav.profile.label}</h1>
			<ProfilePanel />
			<ExportDataCard />
			<TestDataCard />
			<ReportProblem />
			<DeleteAccountCard />
			<Link to="/privacy" className="text-sm text-text-muted hover:text-text">
				{privacy.title}
			</Link>
		</div>
	);
}
