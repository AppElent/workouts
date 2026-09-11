/**
 * How the screen tests mount the app.
 *
 * `renderRouter` can be pointed at the real `app/` directory, and that is the
 * truest thing it can do — but it then loads every route in the tree, which
 * drags the chart library, the Convex client and the whole session stack into a
 * test about a meal slot. So the map below is the tree the Nutrition work
 * actually spans: the real route modules — the tab plus the four Nutrition
 * sub-screens now pushed over it — the real Profile route they are
 * reached from, and a layout carrying the three providers those screens need
 * — `ConfirmProvider` included, since #73's delete confirmation is real UI
 * under test here, not a mock.
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
import * as NutritionComboNewRoute from "../../app/(app)/nutrition-combo-new";
import * as NutritionCombosRoute from "../../app/(app)/nutrition-combos";
import * as NutritionEntryRoute from "../../app/(app)/nutrition-entry";
import * as NutritionFoodRoute from "../../app/(app)/nutrition-food";
import * as NutritionGoalsRoute from "../../app/(app)/nutrition-goals";
import type { FetchLike } from "../data/open-food-facts";
import { OpenFoodFactsProvider } from "../data/open-food-facts-context";
import {
	createOpenFoodFactsCache,
	createPersonalFoodRepository,
	type OpenFoodFactsCache,
	type PersonalFoodRepository,
} from "../data/personal-food-repository";
import { PersonalFoodsProvider } from "../data/personal-foods";
import { LocaleProvider } from "../i18n";
import { ConfirmProvider } from "../ui/confirm-dialog";
import { ToastProvider } from "../ui/toast";
import { NativeAlertHost } from "./native-alert-host";
import { SQLiteTestDatabase } from "./sqlite-test-database";

export function TestLayout({
	repository,
	offCache,
	fetchImpl,
}: {
	repository: PersonalFoodRepository;
	offCache: OpenFoodFactsCache;
	fetchImpl?: FetchLike;
}): ReactNode {
	return (
		<LocaleProvider>
			<NativeAlertHost>
				<ToastProvider>
					<ConfirmProvider>
						<PersonalFoodsProvider repository={repository}>
							<OpenFoodFactsProvider cache={offCache} fetchImpl={fetchImpl}>
								<Slot />
							</OpenFoodFactsProvider>
						</PersonalFoodsProvider>
					</ConfirmProvider>
				</ToastProvider>
			</NativeAlertHost>
		</LocaleProvider>
	);
}

export function renderApp(
	initialUrl = "/nutrition",
	/** Replace a route module — used to make a route throw on purpose. */
	overrides: Record<string, unknown> = {},
	/** A fake fetch for tests that exercise the Open Food Facts network boundary. */
	fetchImpl?: FetchLike,
) {
	const repository = createPersonalFoodRepository(new SQLiteTestDatabase());
	const offCache = createOpenFoodFactsCache(new SQLiteTestDatabase());
	function Layout() {
		return (
			<TestLayout
				repository={repository}
				offCache={offCache}
				fetchImpl={fetchImpl}
			/>
		);
	}
	const rendered = renderRouter(
		{
			_layout: Layout as never,
			nutrition: NutritionRoute as never,
			"nutrition-food": NutritionFoodRoute as never,
			"nutrition-entry": NutritionEntryRoute as never,
			"nutrition-combos": NutritionCombosRoute as never,
			"nutrition-combo-new": NutritionComboNewRoute as never,
			"nutrition-goals": NutritionGoalsRoute as never,
			language: LanguageRoute as never,
			profile: ProfileRoute as never,
			...(overrides as Record<string, never>),
		},
		{ initialUrl },
	);
	return Object.assign(rendered, { repository, offCache });
}
