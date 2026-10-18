import { RedirectToSignIn, Show } from "@clerk/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExportDataCard } from "#/components/account/ExportDataCard";
import { ReportProblem } from "#/components/account/ReportProblem";
import { TestDataCard } from "#/components/account/TestDataCard";
import { ProfilePanel } from "#/lib/auth";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/account/")({
	ssr: false,
	component: AccountPageGuarded,
});

function AccountPageGuarded() {
	return (
		<>
			<Show when="signed-in">
				<AccountPage />
			</Show>
			<Show when="signed-out">
				<RedirectToSignIn />
			</Show>
		</>
	);
}

function AccountPage() {
	const { privacy } = useMessages();
	return (
		<div className="p-4 sm:p-6 max-w-4xl mx-auto flex flex-col gap-6">
			<h1 className="text-2xl font-bold text-white">Account</h1>
			<ProfilePanel />
			<ExportDataCard />
			<TestDataCard />
			<ReportProblem />
			<Link
				to="/privacy"
				className="text-sm text-[var(--text-muted)] hover:text-white"
			>
				{privacy.title}
			</Link>
		</div>
	);
}
