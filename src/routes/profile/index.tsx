import { createFileRoute, redirect } from "@tanstack/react-router";

// The profile page moved to the app-owned ProfilePanel (src/lib/auth) at /account.
// Keep this path as a redirect so existing links/bookmarks still work.
export const Route = createFileRoute("/profile/")({
	beforeLoad: () => {
		throw redirect({ to: "/account" });
	},
});
