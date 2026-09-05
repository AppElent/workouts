/**
 * The phone as a second client of the same Convex deployment the web app
 * uses. No mobile backend, no mobile schema — see `api.ts`.
 *
 * **Static dot access on `process.env` is load-bearing**, for the same
 * reason it is in `auth/config.ts`: Metro substitutes `EXPO_PUBLIC_*`
 * textually at build time, so a computed read (`process.env[name]`,
 * destructuring) yields `undefined` in a release build while appearing to
 * work in dev.
 */
import { useAuth } from "@clerk/expo";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
	throw new Error(
		"EXPO_PUBLIC_CONVEX_URL is not set. Add it to apps/mobile/.env.local (see .env.example).",
	);
}

// unsavedChangesWarning is a beforeunload handler and opt-*out*: left unset,
// the client reaches for `window.addEventListener`, which doesn't exist on
// this runtime.
const convex = new ConvexReactClient(CONVEX_URL, {
	unsavedChangesWarning: false,
});

export function AppConvexProvider({ children }: { children: ReactNode }) {
	// `useAuth` here comes from `@clerk/expo` (Clerk Core 3) while the web
	// passes `@clerk/clerk-react`'s (Core 2). Convex only ever calls the hook
	// and reads a token off it, so this is the entire seam that lets mobile
	// run a Clerk generation ahead of web without forcing a web bump.
	return (
		<ConvexProviderWithClerk client={convex} useAuth={useAuth}>
			{children}
		</ConvexProviderWithClerk>
	);
}
