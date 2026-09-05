/**
 * How the screen tests mount the app.
 *
 * `renderRouter` can be pointed at the real `app/` directory, and that is the
 * truest thing it can do — but it then loads every route in the tree, which
 * drags the chart library, the Convex client and the whole session stack into a
 * test about a meal slot. So the map below is the tree the Nutrition work
 * actually spans: the two real route modules, the real Profile route they are
 * reached from, and a layout carrying the two providers those screens need.
 *
 * The route *modules* are passed rather than their default exports, so a
 * route's `ErrorBoundary` is registered here exactly as expo-router registers
 * it in the app. Nothing is stubbed in between: this is the real router, the
 * real screens, the real locale provider, driven through user-visible actions.
 */
import { Slot } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import type { ReactNode } from "react";
import * as NutritionRoute from "../../app/(app)/(coach)/nutrition";
import * as ProfileRoute from "../../app/(app)/(coach)/profile";
import * as LanguageRoute from "../../app/(app)/language";
import { LocaleProvider } from "../i18n";
import { ToastProvider } from "../ui/toast";

export function TestLayout(): ReactNode {
	return (
		<LocaleProvider>
			<ToastProvider>
				<Slot />
			</ToastProvider>
		</LocaleProvider>
	);
}

export function renderApp(
	initialUrl = "/nutrition",
	/** Replace a route module — used to make a route throw on purpose. */
	overrides: Record<string, unknown> = {},
) {
	return renderRouter(
		{
			_layout: TestLayout as never,
			nutrition: NutritionRoute as never,
			language: LanguageRoute as never,
			profile: ProfileRoute as never,
			...(overrides as Record<string, never>),
		},
		{ initialUrl },
	);
}
