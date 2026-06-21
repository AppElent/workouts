import { createFileRoute, redirect } from "@tanstack/react-router";

// The profile page moved to the shared @appelent/auth ProfilePanel at /account.
// Keep this path as a redirect so existing links/bookmarks still work.
export const Route = createFileRoute("/profile/")({
	beforeLoad: () => {
		throw redirect({ to: "/account" });
	},
});
