import type { ReactNode } from "react";
import { AccountWriteProvider } from "./data/account-write";
import type { FoodShortcutRepository } from "./data/food-shortcut-repository";
import { NutritionDraftsProvider } from "./data/nutrition-drafts";
import {
	type FoodPhotoUpload,
	FoodPhotoUploadProvider,
} from "./data/nutrition-food-photo-upload";
import { FoodShortcutsProvider } from "./data/nutrition-shortcuts";
import type { FetchLike } from "./data/open-food-facts";
import type { OpenFoodFactsCache } from "./data/open-food-facts-cache";
import { OpenFoodFactsProvider } from "./data/open-food-facts-context";
import type { PersonalFoodCache } from "./data/personal-food-cache";
import { PersonalFoodsProvider } from "./data/personal-foods";
import { PersonalMeasuresProvider } from "./data/personal-measures";
import { FoodAuthoringIntentProvider } from "./features/nutrition/food-authoring-intent";
import { StrengthSessionProvider } from "./features/strength-session/data/strength-session-provider";

/** Stores the screen tests inject; the app leaves every one to its default. */
export type AppDataOverrides = {
	personalFoods?: PersonalFoodCache;
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
				<PersonalFoodsProvider cache={overrides.personalFoods}>
					<FoodAuthoringIntentProvider>
						<OpenFoodFactsProvider
							cache={overrides.openFoodFactsCache}
							fetchImpl={overrides.fetchImpl}
						>
							<FoodShortcutsProvider repository={overrides.foodShortcuts}>
								<NutritionDraftsProvider>
									<PersonalMeasuresProvider>
										<StrengthSessionProvider>
											{children}
										</StrengthSessionProvider>
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
