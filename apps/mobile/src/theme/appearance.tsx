import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";
import { Appearance, useColorScheme } from "react-native";
import {
	PREFERENCE_KEYS,
	readPreference,
	writePreference,
} from "../prefs/local-preference";
import {
	darkColors,
	lightColors,
	lightSportMeta,
	type SportKey,
	sportMeta,
	type Tokens,
} from "./tokens";

export type AppearancePreference = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

function readAppearance(): AppearancePreference {
	const saved = readPreference(PREFERENCE_KEYS.appearance);
	return saved === "light" || saved === "dark" ? saved : "system";
}

type AppearanceValue = {
	preference: AppearancePreference;
	scheme: ColorScheme;
	colors: Tokens;
	setPreference: (next: AppearancePreference) => boolean;
};

const AppearanceContext = createContext<AppearanceValue | null>(null);

/** Phone-local preference, available before auth and before the first frame. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
	const [preference, setStoredPreference] = useState(readAppearance);
	const nativeScheme = useColorScheme();
	const scheme =
		preference === "system"
			? nativeScheme === "dark"
				? "dark"
				: "light"
			: preference;

	useLayoutEffect(() => {
		Appearance.setColorScheme(
			preference === "system" ? "unspecified" : preference,
		);
	}, [preference]);

	const setPreference = useCallback((next: AppearancePreference) => {
		// Reset the native override before rendering System. RN reads the device
		// preference synchronously when its override becomes unspecified.
		Appearance.setColorScheme(next === "system" ? "unspecified" : next);
		const persisted = writePreference(PREFERENCE_KEYS.appearance, next);
		setStoredPreference(next);
		return persisted;
	}, []);

	const value = useMemo(
		() => ({
			preference,
			scheme,
			colors: scheme === "dark" ? darkColors : lightColors,
			setPreference,
		}),
		[preference, scheme, setPreference],
	);

	return <AppearanceContext value={value}>{children}</AppearanceContext>;
}

export function useAppearance(): AppearanceValue {
	const value = use(AppearanceContext);
	if (!value)
		throw new Error("useAppearance must be used within AppearanceProvider");
	return value;
}

export function useTokens(): Tokens {
	return useAppearance().colors;
}

export function useSportMeta() {
	return useAppearance().scheme === "dark" ? sportMeta : lightSportMeta;
}

/** Cache each stylesheet until the semantic palette changes. */
export function useThemedStyles<T>(createStyles: (colors: Tokens) => T): T {
	const colors = useTokens();
	return useMemo(() => createStyles(colors), [createStyles, colors]);
}

/** Native hosts and React content must use the same persisted appearance. */
export function useScheme(): ColorScheme {
	return useAppearance().scheme;
}
export function useHostScheme(): ColorScheme {
	return useScheme();
}
export function useSportColors(sport: SportKey) {
	const { color, dim } = useSportMeta()[sport];
	return { color, dim };
}
