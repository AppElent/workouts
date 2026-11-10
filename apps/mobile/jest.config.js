/**
 * Jest, and only inside `apps/mobile`; the rest of the repo runs Vitest.
 * `jest-expo` is the only maintained preset that both transforms Flow-typed
 * `node_modules` (`react-native`, every `expo-*`) and supplies the
 * native-module mocks, and `expo-router/testing-library` is written against
 * Jest's globals and `jest.mock`.
 *
 * `transformIgnorePatterns` is the fiddly part under pnpm. Packages do not live
 * at `node_modules/<name>` but at `node_modules/.pnpm/<name>@<version>/node_modules/<name>`,
 * so the usual `node_modules/(?!expo|react-native|…)` allow-list matches at the
 * *first* `node_modules/` — where the next segment is `.pnpm` — and refuses to
 * transform anything. Matching the package name anywhere in the path instead is
 * what makes the Flow-typed Expo packages transformable here.
 */

const mustTransform = [
	"@expo",
	"@react-native",
	"@react-navigation",
	"@testing-library",
	"convex-helpers",
	"expo",
	"expo-.*",
	"jest-expo",
	"react-native",
	"react-native-.*",
	"standard-navigation",
].join("|");

module.exports = {
	preset: "jest-expo",
	setupFiles: [
		require.resolve("react-native-gesture-handler/jestSetup"),
		"<rootDir>/jest.setup.ts",
	],
	// Reanimated 4.7 / Worklets 0.13 (SDK 58) load JSI-only `.native` builds
	// unless Jest resolves their test entry points through Reanimated's resolver.
	resolver: require.resolve("react-native-reanimated/jest/resolver"),
	testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
	// Both separators everywhere: on Windows these patterns are tested against
	// backslash paths, and a `node_modules/` written with a forward slash alone
	// matches nothing there — so every package is left untransformed and the
	// first Flow-typed import throws.
	transformIgnorePatterns: [
		`node_modules[\\\\/](?!([^\\\\/]+[\\\\/])*(${mustTransform})[\\\\/])`,
	],
};
