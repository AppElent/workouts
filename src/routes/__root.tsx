import {
	AuthConfigProvider,
	DEFAULT_AUTH_CONFIG,
	THEME_INIT_SCRIPT,
} from "@appelent/auth";
import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { AppShell } from "#/components/AppShell";
import { ConfirmDialogProvider } from "#/components/ui/confirm-dialog";
import { ToastHost } from "#/components/ui/toast";
import AppClerkProvider from "#/integrations/clerk/provider";
import AppConvexProvider from "#/integrations/convex/provider";
import { type Locale, LocaleProvider, readClientLocale } from "#/lib/i18n";
import { LanguageSync } from "#/lib/i18n/LanguageSync";
import { getSsrLocale } from "#/lib/i18n/server";

import appCss from "../styles.css?url";

const AUTH_CONFIG = {
	...DEFAULT_AUTH_CONFIG,
	appName: "Workout Tracker",
};

// Routes that render without the AppShell chrome (sidebar / bottom nav).
const BARE_ROUTES = [
	"/sign-in",
	"/sign-up",
	"/forgot-password",
	"/login",
	"/api/cli/auth",
	"/mcp/auth",
];

export const Route = createRootRoute({
	loader: async () => {
		try {
			if (typeof document !== "undefined") {
				return { locale: readClientLocale() };
			}
			const { locale } = (await getSsrLocale()) as { locale: Locale };
			return { locale };
		} catch {
			// SSR locale resolution is best-effort; the client corrects it
			// from the cookie/navigator.language once the loader re-runs
			// after hydration.
			return { locale: "en" as Locale };
		}
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Workout Tracker" },
			{ name: "theme-color", content: "#000000" },
			{ name: "apple-mobile-web-app-capable", content: "yes" },
			{ name: "apple-mobile-web-app-status-bar-style", content: "default" },
		],
		links: [
			{
				rel: "icon",
				type: "image/png",
				sizes: "192x192",
				href: "/logo192.png",
			},
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png",
			},
			{ rel: "manifest", href: "/manifest.webmanifest" },
			{ rel: "stylesheet", href: appCss },
		],
	}),
	shellComponent: RootDocument,
	component: RootLayout,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: intentional inline theme init script */}
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

function RootLayout() {
	const { locale } = Route.useLoaderData() ?? { locale: "en" as Locale };

	useEffect(() => {
		if (typeof window === "undefined" || !("serviceWorker" in navigator))
			return;
		navigator.serviceWorker.register("/sw.js").catch(() => {
			// non-fatal: app still works without offline/installable support
		});
	}, []);

	// Shell's <html lang> is a static SSR fallback (shellComponent renders
	// outside the router match tree, so it has no loader access); sync the
	// resolved locale onto the document once the route data is available.
	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	return (
		<LocaleProvider initialLocale={locale}>
			<AppClerkProvider>
				<AppConvexProvider>
					<AuthConfigProvider config={AUTH_CONFIG}>
						<LanguageSync />
						<ToastHost>
							<ConfirmDialogProvider>
								<AppContent />
							</ConfirmDialogProvider>
						</ToastHost>
						{import.meta.env.DEV && <TanStackRouterDevtools />}
					</AuthConfigProvider>
				</AppConvexProvider>
			</AppClerkProvider>
		</LocaleProvider>
	);
}

function AppContent() {
	const { location } = useRouterState();

	if (
		location.pathname === "/" ||
		BARE_ROUTES.some((route) => location.pathname.startsWith(route))
	) {
		return <Outlet />;
	}

	return <AppShell />;
}
