import { DEFAULT_LOCALE } from "@foundry/core";
import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { ConfirmDialogProvider } from "#/components/ui/confirm-dialog";
import { ToastHost } from "#/components/ui/toast";
import AppClerkProvider from "#/integrations/clerk/provider";
import AppConvexProvider from "#/integrations/convex/provider";
import { LocaleProvider, readClientLocale } from "#/lib/i18n";
import { LanguageSync } from "#/lib/i18n/LanguageSync";
import { getSsrLocale } from "#/lib/i18n/server";
import { reportError } from "#/lib/observability/errors";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
	loader: async () => {
		try {
			return {
				locale:
					typeof document !== "undefined"
						? readClientLocale()
						: await getSsrLocale(),
			};
		} catch (error) {
			// The client re-runs the loader after hydration and reads the
			// cookie or navigator.language.
			reportError(error, "resolveLocale");
			return { locale: DEFAULT_LOCALE };
		}
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Foundry" },
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
		<html lang={DEFAULT_LOCALE}>
			<head>
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
	const { locale } = Route.useLoaderData();

	useEffect(() => {
		if (typeof window === "undefined" || !("serviceWorker" in navigator))
			return;
		navigator.serviceWorker
			.register("/sw.js")
			.catch((error) => reportError(error, "registerServiceWorker"));
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
					<LanguageSync />
					<ToastHost>
						<ConfirmDialogProvider>
							<Outlet />
						</ConfirmDialogProvider>
					</ToastHost>
					{import.meta.env.DEV && <TanStackRouterDevtools />}
				</AppConvexProvider>
			</AppClerkProvider>
		</LocaleProvider>
	);
}
