import { api } from "@convex/_generated/api";
import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { AppShell } from "#/components/AppShell";
import AppClerkProvider from "#/integrations/clerk/provider";
import AppConvexProvider from "#/integrations/convex/provider";

import appCss from "../styles.css?url";

const THEME_INIT = `(function(){try{var s=window.localStorage.getItem('theme');var m=s==='light'||s==='dark'||s==='auto'?s:'auto';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var r=m==='auto'?(d?'dark':'light'):m;var e=document.documentElement;e.classList.remove('light','dark');e.classList.add(r);m==='auto'?e.removeAttribute('data-theme'):e.setAttribute('data-theme',m);e.style.colorScheme=r;}catch(e){}})();`;

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Workout Tracker" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	shellComponent: RootDocument,
	component: RootLayout,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
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
				<AppContent />
				{import.meta.env.DEV && <TanStackRouterDevtools />}
			</AppConvexProvider>
		</AppClerkProvider>
	);
}

function AppContent() {
	const { location } = useRouterState();
	const navigate = useNavigate();
	const activeSession = useQuery(api.workoutSessions.getActive);

	useEffect(() => {
		if (activeSession) {
			void navigate({
				to: "/log/$sessionId",
				params: { sessionId: activeSession._id },
				replace: true,
			});
		}
	}, [activeSession, navigate]);

	if (location.pathname === "/" || location.pathname.startsWith("/login")) {
		return <Outlet />;
	}

	return <AppShell />;
}
