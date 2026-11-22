import { enUS, nlNL } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/react";
import { AUTH_PATHS } from "#/lib/auth/paths";
import { type Locale, useI18n } from "#/lib/i18n";
import { SentryUser } from "#/lib/observability/user";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * Clerk's own UI (the reverification dialog) in the app's language. English is
 * passed explicitly so switching back from Dutch resets Clerk's strings.
 */
const CLERK_LOCALIZATION = {
	en: enUS,
	nl: nlNL,
} satisfies Record<Locale, typeof enUS>;

export default function AppClerkProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { locale } = useI18n();
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
			signInUrl={AUTH_PATHS.signIn}
			signUpUrl={AUTH_PATHS.signUp}
			localization={CLERK_LOCALIZATION[locale]}
		>
			<SentryUser />
			{children}
		</ClerkProvider>
	);
}
