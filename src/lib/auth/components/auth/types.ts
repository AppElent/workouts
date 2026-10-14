import type React from "react";

export type SlotClassNames<Slot extends string> = Partial<Record<Slot, string>>;

export interface SocialProvider {
	id: string; // e.g. "google"
	label: string;
	strategy: `oauth_${string}`;
}

export interface AuthConfig {
	appName: string;
	logo?: React.ReactNode;
	paths: {
		signIn: string;
		signUp: string;
		forgotPassword: string;
		afterAuth: string;
		account: string;
		ssoCallback: string;
	};
	features: { forgotPassword: boolean };
	socialProviders: SocialProvider[];
}

// Moved to ../core (DOM-free, shared with mobile) — re-exported here so
// existing imports of `clerkErrorMessage` from "./types" keep working
// unchanged. See AppElent/workouts#48.
export { clerkErrorMessage } from "#/lib/auth/core";
