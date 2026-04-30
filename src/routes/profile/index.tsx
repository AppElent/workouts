import {
	RedirectToSignIn,
	SignedIn,
	SignedOut,
	UserProfile,
} from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profile/")({
	component: ProfilePageGuarded,
});

const clerkAppearance = {
	variables: {
		colorBackground: "#1a1a1a",
		colorPrimary: "#1DB954",
		colorText: "#ffffff",
		colorTextSecondary: "#b3b3b3",
		colorInputBackground: "#242424",
		colorInputText: "#ffffff",
		borderRadius: "12px",
	},
};

function ProfilePageGuarded() {
	return (
		<>
			<SignedIn>
				<ProfilePage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function ProfilePage() {
	return (
		<div className="p-4 sm:p-6 max-w-4xl mx-auto">
			<h1 className="text-2xl font-bold text-white mb-6">Profile</h1>
			<UserProfile appearance={clerkAppearance} />
		</div>
	);
}
