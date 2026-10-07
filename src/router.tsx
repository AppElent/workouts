import * as Sentry from "@sentry/react";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { RouteErrorFallback } from "#/components/RouteErrorFallback";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultErrorComponent: RouteErrorFallback,
	});

	if (!router.isServer) {
		const trackScreen = () => {
			Sentry.setTag("screen", router.state.matches.at(-1)?.routeId || "/");
		};
		router.subscribe("onResolved", trackScreen);
		trackScreen();
		Sentry.addIntegration(
			Sentry.tanstackRouterBrowserTracingIntegration(router),
		);
	}
	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
