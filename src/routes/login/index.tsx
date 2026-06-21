import { createFileRoute, redirect } from "@tanstack/react-router";

// The dedicated /login page was replaced by the shared @appelent/auth flow at
// /sign-in. Keep this path as a redirect so existing links/bookmarks still work.
export const Route = createFileRoute("/login/")({
	beforeLoad: () => {
		throw redirect({ to: "/sign-in" });
	},
});
