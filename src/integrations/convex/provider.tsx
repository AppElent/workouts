import { useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

// biome-ignore lint/suspicious/noExplicitAny: import.meta.env not typed outside Vite context
const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL;

// Lazily instantiate so a missing build-time URL fails inside the component,
// not at module load — see clerk/provider.tsx for the same reason.
let convexClient: ConvexReactClient | undefined;

export default function AppConvexProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	if (!CONVEX_URL) {
		throw new Error("missing env var VITE_CONVEX_URL");
	}
	if (!convexClient) convexClient = new ConvexReactClient(CONVEX_URL);
	return (
		<ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
			{children}
		</ConvexProviderWithClerk>
	);
}
