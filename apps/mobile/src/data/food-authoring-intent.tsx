import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";
import type { FoodVisual } from "./personal-food-repository";

export type FoodAuthoringIntent = "personal" | "recipe" | "oneOff";

/**
 * What switching between Personal food, Recipe and One-off carries along, so
 * the person does not type the name or take the photo twice. A staged photo
 * handed over here belongs to the receiving form from then on.
 */
export type FoodAuthoringSeed = {
	readonly name: string;
	readonly visual?: FoodVisual;
};

type FoodAuthoringIntentValue = {
	intent?: FoodAuthoringIntent;
	seed?: FoodAuthoringSeed;
	request: (intent: FoodAuthoringIntent, seed?: FoodAuthoringSeed) => void;
	consume: () => void;
};

const Context = createContext<FoodAuthoringIntentValue | undefined>(undefined);

export function FoodAuthoringIntentProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [state, setState] = useState<{
		intent: FoodAuthoringIntent;
		seed?: FoodAuthoringSeed;
	}>();
	const value = useMemo(
		() => ({
			intent: state?.intent,
			seed: state?.seed,
			request: (intent: FoodAuthoringIntent, seed?: FoodAuthoringSeed) =>
				setState({ intent, seed }),
			consume: () => setState(undefined),
		}),
		[state],
	);
	return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useFoodAuthoringIntent(): FoodAuthoringIntentValue {
	const value = useContext(Context);
	if (!value) throw new Error("Food authoring intent provider is missing.");
	return value;
}
