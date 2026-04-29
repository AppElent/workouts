import {
	SignedIn,
	SignedOut,
	SignInButton,
	UserButton,
	useUser,
} from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/demo/clerk")({
	component: App,
});

function App() {
	const { user, isLoaded } = useUser();

	if (!isLoaded) {
		return <div className="p-4">Loading...</div>;
	}

	return (
		<div className="p-4">
			<SignedIn>
				Hello {user?.firstName}!
				<UserButton />
			</SignedIn>
			<SignedOut>
				<div className="p-4">Sign in to view this page</div>
				<SignInButton />
			</SignedOut>
		</div>
	);
}
