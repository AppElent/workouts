import {
	ConvexQueryCacheProvider,
	useQueries as useHelperQueries,
	useQuery as useHelperQuery,
} from "convex-helpers/react/cache";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import { AppState } from "react-native";
import { useScreenQueryActive } from "../data/screen-query-active";

const CacheActiveContext = createContext(false);

/** Retain a small number of live queries for quick returns within one account. */
export function AppQueryCacheProvider({
	scope,
	children,
}: {
	scope: string;
	children: ReactNode;
}) {
	const [foreground, setForeground] = useState(
		() => AppState.currentState === "active",
	);
	useEffect(() => {
		const listener = AppState.addEventListener("change", (state) =>
			setForeground(state === "active"),
		);
		return () => listener.remove();
	}, []);
	return (
		<CacheActiveContext.Provider value={foreground}>
			<ConvexQueryCacheProvider
				key={scope}
				expiration={foreground ? 30_000 : 0}
				maxIdleEntries={foreground ? 20 : 0}
			>
				{children}
			</ConvexQueryCacheProvider>
		</CacheActiveContext.Provider>
	);
}

function useCacheActive() {
	const foreground = useContext(CacheActiveContext);
	const screenActive = useScreenQueryActive();
	return foreground && screenActive;
}

// Keep the helper's query/argument inference at the app boundary. Searches and
// large histories opt in separately; importing these hooks selects retention.
export const useCachedQuery: typeof useHelperQuery = (query, ...args) => {
	const active = useCacheActive();
	return useHelperQuery(query, ...(active ? args : ["skip"]));
};

export const useCachedQueries: typeof useHelperQueries = (queries) => {
	const active = useCacheActive();
	return useHelperQueries(active ? queries : {});
};
