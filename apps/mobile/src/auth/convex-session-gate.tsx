/**
 * Holds the signed-in subtree until the Convex websocket is actually
 * authenticated.
 *
 * Clerk and Convex answer "is this user signed in?" at different moments.
 * Clerk's `isSignedIn` flips as soon as the session token is readable from
 * SecureStore; Convex only counts as authenticated once that token has been
 * minted for the Convex template, pushed over the websocket and accepted by
 * the backend. Between those two instants every `useQuery` in the subtree is
 * live and unauthenticated, and each one throws `Unauthenticated` out of
 * render — the red box the user sees on a cold start or when a stale session
 * is being refreshed.
 *
 * Navigation follows Clerk, data follows Convex: `(app)/_layout` guards the
 * redirect on `isSignedIn`, and this gate sits below it.
 *
 * It renders a bare themed surface rather than a spinner: on the common path
 * the handshake is a few hundred milliseconds behind a splash screen that is
 * still up, and a spinner that flashes for one frame reads as a glitch.
 */
import { useConvexAuth } from "convex/react";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { type Tokens, useThemedStyles } from "../theme";

export function ConvexSessionGate({ children }: { children: ReactNode }) {
	const { isAuthenticated } = useConvexAuth();
	const styles = useThemedStyles(createStyles);
	if (!isAuthenticated) return <View style={styles.root} />;
	return children;
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
	});
