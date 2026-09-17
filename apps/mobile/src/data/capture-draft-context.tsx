import { createContext, type ReactNode, use } from "react";
import type { NutritionCookingRepository } from "./nutrition-cooking-repository";

const CaptureDraftRepositoryContext = createContext<
	NutritionCookingRepository | undefined
>(undefined);

/** Hosts can supply the real SQLite adapter; ordinary routes open the device store. */
export function CaptureDraftRepositoryProvider({
	repository,
	children,
}: {
	repository: NutritionCookingRepository;
	children: ReactNode;
}) {
	return (
		<CaptureDraftRepositoryContext value={repository}>
			{children}
		</CaptureDraftRepositoryContext>
	);
}

export function useSuppliedCaptureDraftRepository() {
	return use(CaptureDraftRepositoryContext);
}
