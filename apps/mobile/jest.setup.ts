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
	const emptyDiary = { entries: [], totals: {} };
	const { getFunctionName } = jest.requireActual("convex/server");
	return {
		...jest.requireActual("convex/react"),
		useQuery: jest.fn((reference) =>
			getFunctionName(reference) === "nutritionDiary:day"
				? emptyDiary
				: emptyQueryResult,
		),
		// The training marker's own, non-throwing query form (see
		// `src/data/training-marker.ts`). Defaults to "no completed Activity
		// found" so every existing screen test keeps its current behaviour;
		// marker-specific tests override this per case.
		useQuery_experimental: jest.fn(() => ({
			status: "success" as const,
			data: false,
		})),
		useMutation: jest.fn(() => jest.fn().mockResolvedValue(undefined)),
		// Connected by default, so every existing test keeps the behaviour it
		// was written against. The Nutrition day reads this to tell "still
		// loading" apart from "will never load because the socket is down", and
		// the offline tests override it per case.
		useConvexConnectionState: jest.fn(() => ({
			isWebSocketConnected: true,
			hasInflightRequests: false,
			hasEverConnected: true,
			connectionCount: 1,
			connectionRetries: 0,
			timeOfOldestInflightRequest: null,
			inflightMutations: 0,
			inflightActions: 0,
		})),
	};
});

/**
 * jest-expo has no native camera to mount, so `CameraView` becomes a tappable
 * stand-in a test can "scan" by pressing, and `useCameraPermissions` starts
 * already granted — the common case — with each test free to override both
 * the permission tuple and the scan trigger via `jest.mocked(...)`, exactly
 * like the `convex/react` mock above.
 */
jest.mock("expo-camera", () => {
	const React = jest.requireActual("react");
	const { Pressable, Text } = jest.requireActual("react-native");
	// Mirrors expo-modules-core's real enum values so a test can import
	// `PermissionStatus` from "expo-camera" the same way production code does.
	const PermissionStatus = {
		GRANTED: "granted",
		UNDETERMINED: "undetermined",
		DENIED: "denied",
	} as const;
	return {
		PermissionStatus,
		useCameraPermissions: jest.fn(() => [
			{
				status: PermissionStatus.GRANTED,
				granted: true,
				canAskAgain: true,
				expires: "never",
			},
			jest.fn().mockResolvedValue({
				status: PermissionStatus.GRANTED,
				granted: true,
				canAskAgain: true,
				expires: "never",
			}),
			jest.fn(),
		]),
		CameraView: ({
			onBarcodeScanned,
		}: {
			onBarcodeScanned?: (r: { data: string; type: string }) => void;
		}) =>
			React.createElement(
				Pressable,
				{
					accessibilityLabel: "Simulated camera preview",
					onPress: () =>
						onBarcodeScanned?.({ data: "5000112637922", type: "ean13" }),
				},
				React.createElement(Text, null, "Simulated camera preview"),
			),
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
