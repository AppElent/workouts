/**
 * What the app needs in place before any route can mount.
 *
 * `renderRouter` mounts `app/_layout.tsx` for real, and that layout constructs
 * a Convex client and asks Clerk whether anyone is signed in. Neither is what
 * these tests are about, so both get the smallest stub that lets the signed-in
 * shell render: an environment variable and a signed-in `useAuth`.
 *
 * The device stores are stubbed rather than mocked away. `expo-sqlite/kv-store`
 * gets a real in-memory map so a locale written by the language screen is read
 * back by the provider — that round trip is behaviour worth keeping, and losing
 * it would make the language tests prove less than they appear to.
 */

// `src/convex/provider.tsx` throws at module load without this. The value is
// never dialled: no test asserts on Convex data.
process.env.EXPO_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_jest";

jest.mock("@clerk/expo", () => ({
	ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
	useAuth: () => ({
		isLoaded: true,
		isSignedIn: true,
		signOut: jest.fn(),
		getToken: jest.fn().mockResolvedValue(null),
	}),
	useUser: () => ({ isLoaded: true, isSignedIn: true, user: null }),
}));

jest.mock("@clerk/expo/token-cache", () => ({ tokenCache: undefined }));

jest.mock("convex/react", () => {
	const emptyQueryResult: never[] = [];
	return {
		...jest.requireActual("convex/react"),
		useQuery: jest.fn(() => emptyQueryResult),
		useMutation: jest.fn(() => jest.fn().mockResolvedValue(undefined)),
	};
});

jest.mock("expo-sqlite/kv-store", () => {
	const store = new Map<string, string>();
	return {
		__esModule: true,
		default: {
			getItemSync: (key: string) => store.get(key) ?? null,
			setItemSync: (key: string, value: string) => {
				store.set(key, value);
			},
			removeItemSync: (key: string) => {
				store.delete(key);
			},
		},
	};
});

// A device set to English, so a test that expects Dutch has to have asked for
// it rather than inheriting it from whoever is running the suite.
jest.mock("expo-localization", () => ({
	getLocales: () => [{ languageTag: "en-GB", languageCode: "en" }],
}));

/**
 * React 19 reports an error an error boundary recovered from by dispatching a
 * global `ErrorEvent`. jest-expo's environment supplies a `window` with an
 * `ErrorEvent` constructor but no `dispatchEvent`, so React's own reporting
 * throws and buries the error the boundary was busy handling. A no-op restores
 * the real behaviour under test: the boundary renders, and retry works.
 */
const maybeWindow = (globalThis as { window?: { dispatchEvent?: unknown } })
	.window;
if (maybeWindow && typeof maybeWindow.dispatchEvent !== "function") {
	maybeWindow.dispatchEvent = () => true;
}
