import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";

export type FoodAuthoringIntent = "personal" | "recipe";

type FoodAuthoringIntentValue = {
	intent?: FoodAuthoringIntent;
	request: (intent: FoodAuthoringIntent) => void;
	consume: () => void;
};

const Context = createContext<FoodAuthoringIntentValue | undefined>(undefined);

export function FoodAuthoringIntentProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [intent, setIntent] = useState<FoodAuthoringIntent>();
	const value = useMemo(
		() => ({ intent, request: setIntent, consume: () => setIntent(undefined) }),
		[intent],
	);
	return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useFoodAuthoringIntent(): FoodAuthoringIntentValue {
	const value = useContext(Context);
	if (!value) throw new Error("Food authoring intent provider is missing.");
	return value;
}
