import { ProfilePanel } from "@appelent/auth";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { ExportDataCard } from "#/components/account/ExportDataCard";

export const Route = createFileRoute("/account/")({
	ssr: false,
	component: AccountPageGuarded,
});

function AccountPageGuarded() {
	return (
		<>
			<SignedIn>
				<AccountPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function AccountPage() {
	return (
		<div className="p-4 sm:p-6 max-w-4xl mx-auto flex flex-col gap-6">
			<h1 className="text-2xl font-bold text-white">Account</h1>
			<ProfilePanel />
			<ExportDataCard />
		</div>
	);
}
