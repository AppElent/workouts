import type { ReactNode } from "react";
import { FoodAuthoringIntentProvider } from "./data/food-authoring-intent";
import { NutritionDraftsProvider } from "./data/nutrition-drafts";
import type { FoodPhotoUpload } from "./data/nutrition-food-photo-upload";
import type { NutritionLocalRepository } from "./data/nutrition-local-repository";
import { NutritionOperationsProvider } from "./data/nutrition-operation-service";
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
	nutrition?: NutritionLocalRepository;
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
		<PersonalFoodsProvider
			repository={overrides.personalFoods}
			uploadPhoto={overrides.uploadPhoto}
		>
			<FoodAuthoringIntentProvider>
				<OpenFoodFactsProvider
					cache={overrides.openFoodFactsCache}
					fetchImpl={overrides.fetchImpl}
				>
					<NutritionOperationsProvider
						repository={overrides.nutrition}
						uploadPhoto={overrides.uploadPhoto}
						subject={overrides.subject}
					>
						<NutritionDraftsProvider>
							<PersonalMeasuresProvider>
								<SetDraftsProvider>{children}</SetDraftsProvider>
							</PersonalMeasuresProvider>
						</NutritionDraftsProvider>
					</NutritionOperationsProvider>
				</OpenFoodFactsProvider>
			</FoodAuthoringIntentProvider>
		</PersonalFoodsProvider>
	);
}
