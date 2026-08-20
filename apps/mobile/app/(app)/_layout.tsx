/**
 * The shell under test — #46.
 *
 * The guard is unchanged from the scaffold: Clerk's `isSignedIn`, never
 * Convex's `isAuthenticated`. The two disagree for the length of the JWT
 * handshake right after sign-in, and guarding on the Convex side produces an
 * infinite bounce between this group and `(auth)`.
 *
 * Everything below the guard is PROTOTYPE (#46). This layout is a plain Stack
 * and stays one — see `src/prototype/shell-variant.tsx` for why swapping it
 * for `NativeTabs` at runtime does not work. Variant B's tab bar lives in the
 * nested `(tabs)` group, which is a screen of this stack.
 *
 * When a variant wins, this file keeps only that variant's navigator and
 * `src/prototype` is deleted.
 */
import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { ShellVariantProvider } from "../../src/prototype/shell-variant";
import { colors } from "../../src/theme";

export default function AppLayout() {
	const { isSignedIn } = useAuth();

	if (!isSignedIn) {
		return <Redirect href="/sign-in" />;
	}

	return (
		<ShellVariantProvider>
			<Stack
				screenOptions={{
					headerShown: false,
					contentStyle: { backgroundColor: colors.bg },
				}}
			/>
		</ShellVariantProvider>
	);
}
