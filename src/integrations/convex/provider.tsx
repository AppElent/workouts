import { useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

// biome-ignore lint/suspicious/noExplicitAny: import.meta.env not typed outside Vite context
const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
	console.error("missing env var VITE_CONVEX_URL");
}

const convexClient = new ConvexReactClient(CONVEX_URL);

export default function AppConvexProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
			{children}
		</ConvexProviderWithClerk>
	);
}
