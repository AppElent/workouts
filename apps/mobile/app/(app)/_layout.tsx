/**
 * Behind the door.
 *
 * Same guard rule as `(auth)`, mirrored: Clerk's `isSignedIn`, not Convex's
 * `isAuthenticated`. See that layout's comment for why the two are not
 * interchangeable here.
 */
import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

export default function AppLayout() {
	const { isSignedIn } = useAuth();

	if (!isSignedIn) {
		return <Redirect href="/sign-in" />;
	}

	return <Stack screenOptions={{ headerShown: false }} />;
}
