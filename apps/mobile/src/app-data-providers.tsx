import type { ReactNode } from "react";
import { AccountWriteProvider } from "./data/account-write";
import { FoodAuthoringIntentProvider } from "./data/food-authoring-intent";
import type { FoodShortcutRepository } from "./data/food-shortcut-repository";
import { NutritionDraftsProvider } from "./data/nutrition-drafts";
import {
	type FoodPhotoUpload,
	FoodPhotoUploadProvider,
} from "./data/nutrition-food-photo-upload";
import { FoodShortcutsProvider } from "./data/nutrition-shortcuts";
import type { FetchLike } from "./data/open-food-facts";
import { OpenFoodFactsProvider } from "./data/open-food-facts-context";
import type {
	OpenFoodFactsCache,
	PersonalFoodRepository,
} from "./data/personal-food-repository";
import { PersonalFoodsProvider } from "./data/personal-foods";
import { PersonalMeasuresProvider } from "./data/personal-measures";
import { SetDraftsProvider } from "./features/strength-session/data/set-drafts";

/** Stores the screen tests inject; the app leaves every one to its default. */
export type AppDataOverrides = {
	personalFoods?: PersonalFoodRepository;
	foodShortcuts?: FoodShortcutRepository;
	openFoodFactsCache?: OpenFoodFactsCache;
	fetchImpl?: FetchLike;
	uploadPhoto?: FoodPhotoUpload;
	subject?: string;
};

/** The account's data providers, mounted once Convex has a session. */
export function AppDataProviders({
	children,
	overrides = {},
}: {
	children: ReactNode;
	overrides?: AppDataOverrides;
}) {
	return (
		<AccountWriteProvider subject={overrides.subject}>
			<FoodPhotoUploadProvider upload={overrides.uploadPhoto}>
				<PersonalFoodsProvider repository={overrides.personalFoods}>
					<FoodAuthoringIntentProvider>
						<OpenFoodFactsProvider
							cache={overrides.openFoodFactsCache}
							fetchImpl={overrides.fetchImpl}
						>
							<FoodShortcutsProvider repository={overrides.foodShortcuts}>
								<NutritionDraftsProvider>
									<PersonalMeasuresProvider>
										<SetDraftsProvider>{children}</SetDraftsProvider>
									</PersonalMeasuresProvider>
								</NutritionDraftsProvider>
							</FoodShortcutsProvider>
						</OpenFoodFactsProvider>
					</FoodAuthoringIntentProvider>
				</PersonalFoodsProvider>
			</FoodPhotoUploadProvider>
		</AccountWriteProvider>
	);
}
