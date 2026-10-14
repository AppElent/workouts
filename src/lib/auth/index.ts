// Components

export { AppearanceSettings } from "#/lib/auth/components/account/AppearanceSettings";
export { AuthButton } from "#/lib/auth/components/auth/AuthButton";
export { AuthCard } from "#/lib/auth/components/auth/AuthCard";
export {
	AuthConfigProvider,
	DEFAULT_AUTH_CONFIG,
	useAuthConfig,
} from "#/lib/auth/components/auth/AuthConfigProvider";
export { AuthError } from "#/lib/auth/components/auth/AuthError";
export { AuthField } from "#/lib/auth/components/auth/AuthField";
export { ForgotPasswordForm } from "#/lib/auth/components/auth/ForgotPasswordForm";
export { ProfilePanel } from "#/lib/auth/components/auth/ProfilePanel";
export { SignInForm } from "#/lib/auth/components/auth/SignInForm";
export { SignUpForm } from "#/lib/auth/components/auth/SignUpForm";
export { SocialButtons } from "#/lib/auth/components/auth/SocialButtons";
export { TestLoginButton } from "#/lib/auth/components/auth/TestLoginButton";
export {
	type AuthConfig,
	clerkErrorMessage,
	type SlotClassNames,
	type SocialProvider,
} from "#/lib/auth/components/auth/types";
export { ThemeSync } from "#/lib/auth/components/ThemeSync";
// Lib
export { shouldShowTestLogin } from "#/lib/auth/core";
export { default as HeaderUser } from "#/lib/auth/integrations/clerk/header-user";
export {
	applyThemeMode,
	getInitialMode,
	reconcileTheme,
	setThemeMode,
	THEME_INIT_SCRIPT,
	type ThemeMode,
} from "#/lib/auth/lib/theme";
