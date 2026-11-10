import { RedirectToSignIn, Show } from "@clerk/react";
import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Every route below needs a signed-in user. */
export const Route = createFileRoute("/_app/_authed")({
	component: SignedInOnly,
});

function SignedInOnly() {
	return (
		<>
			<Show when="signed-in">
				<Outlet />
			</Show>
			<Show when="signed-out">
				<RedirectToSignIn />
			</Show>
		</>
	);
}
