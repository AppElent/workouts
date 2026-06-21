import { ProfilePanel } from "@appelent/auth";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

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
		<div className="p-4 sm:p-6 max-w-4xl mx-auto">
			<h1 className="text-2xl font-bold text-white mb-6">Account</h1>
			<ProfilePanel />
		</div>
	);
}
