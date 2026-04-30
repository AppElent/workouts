import { SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/login/")({
	component: LoginPage,
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

function AlreadySignedIn() {
	const navigate = useNavigate();
	useEffect(() => {
		void navigate({ to: "/dashboard", replace: true });
	}, [navigate]);
	return null;
}

function LoginPage() {
	return (
		<div
			className="relative min-h-screen flex flex-col overflow-hidden"
			style={{ background: "#000" }}
		>
			{/* Green glow blobs */}
			<div
				aria-hidden
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					width: 400,
					height: 400,
					background:
						"radial-gradient(circle, rgba(29,185,84,0.12), transparent 65%)",
					pointerEvents: "none",
				}}
			/>
			<div
				aria-hidden
				style={{
					position: "fixed",
					bottom: 0,
					right: 0,
					width: 300,
					height: 300,
					background:
						"radial-gradient(circle, rgba(29,185,84,0.06), transparent 65%)",
					pointerEvents: "none",
				}}
			/>

			{/* Logo */}
			<header className="relative z-10 flex items-center px-6 py-5">
				<div className="flex items-center gap-2.5">
					<div
						className="w-[30px] h-[30px] rounded-[6px] flex items-center justify-center font-black text-black text-[15px]"
						style={{ background: "#1DB954" }}
					>
						W
					</div>
					<span className="text-white font-bold text-sm">Workout Tracker</span>
				</div>
			</header>

			{/* Centered sign-in form */}
			<div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12">
				<SignedOut>
					<SignIn forceRedirectUrl="/dashboard" appearance={clerkAppearance} />
				</SignedOut>
				<SignedIn>
					<AlreadySignedIn />
				</SignedIn>
			</div>
		</div>
	);
}
