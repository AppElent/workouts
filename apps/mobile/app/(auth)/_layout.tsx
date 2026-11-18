/**
 * The signed-out half of the app.
 *
 * The guard is Clerk's `isSignedIn`, never Convex's `isAuthenticated` — the
 * two disagree for the length of the JWT handshake right after a sign-in,
 * and guarding on the Convex side produces an infinite bounce between this
 * group and `(app)`.
 *
 * A join link opened while signed out returns to the join route afterwards.
 */
import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { pendingJoin } from "../../src/features/training/hosted/pending-join";

export default function AuthLayout() {
	const { isSignedIn } = useAuth();

	if (isSignedIn) {
		// Back to a join link opened while signed out (`pending-join.ts`).
		const token = pendingJoin();
		return (
			<Redirect
				href={token ? { pathname: "/join/[token]", params: { token } } : "/"}
			/>
		);
	}

	return <Stack screenOptions={{ headerShown: false }} />;
}
