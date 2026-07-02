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
import { AppShell } from "#/components/AppShell";
import AppClerkProvider from "#/integrations/clerk/provider";
import AppConvexProvider from "#/integrations/convex/provider";

import appCss from "../styles.css?url";

const AUTH_CONFIG = {
	...DEFAULT_AUTH_CONFIG,
	appName: "Workout Tracker",
};

// Routes that render without the AppShell chrome (sidebar / bottom nav).
const BARE_ROUTES = ["/sign-in", "/sign-up", "/forgot-password", "/login"];

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Workout Tracker" },
		],
		links: [
			{
				rel: "icon",
				type: "image/png",
				sizes: "192x192",
				href: "/logo192.png",
			},
			{ rel: "apple-touch-icon", sizes: "192x192", href: "/logo192.png" },
			{ rel: "manifest", href: "/manifest.json" },
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
	return (
		<AppClerkProvider>
			<AppConvexProvider>
				<AuthConfigProvider config={AUTH_CONFIG}>
					<AppContent />
					{import.meta.env.DEV && <TanStackRouterDevtools />}
				</AuthConfigProvider>
			</AppConvexProvider>
		</AppClerkProvider>
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
