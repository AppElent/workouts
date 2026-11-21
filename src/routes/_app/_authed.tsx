import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SignedInGate } from "#/lib/auth/SessionGate";

export const Route = createFileRoute("/_app/_authed")({
	component: SignedInOnly,
});

function SignedInOnly() {
	return (
		<SignedInGate>
			<Outlet />
		</SignedInGate>
	);
}
