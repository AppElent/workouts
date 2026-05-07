import { ClerkProvider } from "@clerk/clerk-react";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function AppClerkProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	// Throw inside the component, not at module top-level: a top-level throw
	// gets dead-code-eliminated by Vite into an unconditional throw when the
	// env var is missing at build time, which then crashes SSR module load
	// and surfaces as a generic h3 500 ("HTTPError", unhandled).
	if (!PUBLISHABLE_KEY) {
		throw new Error("Add your Clerk Publishable Key to the .env.local file");
	}
	return (
		<ClerkProvider
			publishableKey={PUBLISHABLE_KEY}
			afterSignOutUrl="/"
			signInUrl="/login"
		>
			{children}
		</ClerkProvider>
	);
}
