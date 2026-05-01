import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Dumbbell, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
	component: IntroPage,
});

const features = [
	{
		icon: Dumbbell,
		title: "Real-time logging",
		description: "Add sets while you're between reps. Auto-saved.",
	},
	{
		icon: TrendingUp,
		title: "1RM tracking",
		description: "Calculated and actual maxes plotted over time.",
	},
	{
		icon: ClipboardList,
		title: "Routines",
		description: "Save your splits, then run them with one tap.",
	},
];

function IntroPage() {
	return (
		<div
			className="relative min-h-screen flex flex-col overflow-hidden"
			style={{ background: "#000" }}
		>
			{/* Green glow blobs — CSS only, no JS */}
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

			{/* Top navigation */}
			<header className="relative z-10 flex items-center justify-between px-8 py-5">
				<div className="flex items-center gap-2.5">
					<div
						className="w-[30px] h-[30px] rounded-[6px] flex items-center justify-center font-black text-black text-[15px]"
						style={{ background: "#1DB954" }}
					>
						W
					</div>
					<span className="text-white font-bold text-sm">Workout Tracker</span>
				</div>

				<nav className="hidden sm:flex items-center gap-7">
					{(["Features", "About"] as const).map((label) => (
						<span
							key={label}
							className="text-[var(--text-muted)]"
							style={{
								fontSize: 11,
								fontWeight: 700,
								textTransform: "uppercase",
								letterSpacing: "1.2px",
							}}
						>
							{label}
						</span>
					))}
					<Link
						to="/login"
						className="text-[var(--text-muted)] hover:text-white transition-colors"
						style={{
							fontSize: 11,
							fontWeight: 700,
							textTransform: "uppercase",
							letterSpacing: "1.2px",
						}}
					>
						Sign In
					</Link>
				</nav>
			</header>

			{/* Hero — centered */}
			<section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-8 py-20">
				<div style={{ maxWidth: 880, width: "100%" }}>
					<p
						className="mb-6"
						style={{
							color: "#1DB954",
							fontSize: 12,
							fontWeight: 700,
							textTransform: "uppercase",
							letterSpacing: "2px",
						}}
					>
						YOUR GYM. YOUR DATA.
					</p>

					<h1
						className="mb-6"
						style={{ lineHeight: 1.05, letterSpacing: "-1.5px" }}
					>
						<span
							className="block text-white"
							style={{ fontSize: 56, fontWeight: 900 }}
						>
							Track every lift.
						</span>
						<span
							className="block text-white"
							style={{ fontSize: 56, fontWeight: 900 }}
						>
							Own every PR.
						</span>
					</h1>

					<p
						className="mb-9 mx-auto"
						style={{
							color: "#b3b3b3",
							fontSize: 16,
							lineHeight: 1.6,
							maxWidth: 560,
						}}
					>
						Log sets, track 1RMs, and watch your strength compound — session by
						session.
					</p>

					<Link
						to="/log"
						className="inline-flex items-center px-8 py-3 font-bold text-black text-sm transition-colors"
						style={{
							background: "#1DB954",
							borderRadius: 9999,
							fontWeight: 700,
						}}
						onMouseEnter={(e) => {
							(e.currentTarget as HTMLElement).style.background = "#1ed760";
						}}
						onMouseLeave={(e) => {
							(e.currentTarget as HTMLElement).style.background = "#1DB954";
						}}
					>
						Start Logging →
					</Link>
				</div>
			</section>

			{/* Feature cards */}
			<section className="relative z-10 pb-16 px-8">
				<div
					className="mx-auto grid gap-4 sm:grid-cols-3"
					style={{ maxWidth: 960 }}
				>
					{features.map(({ icon: Icon, title, description }) => (
						<div
							key={title}
							className="rounded-xl p-5 border"
							style={{
								background: "var(--surface)",
								borderColor: "var(--border)",
							}}
						>
							<Icon
								size={20}
								style={{ color: "var(--accent)" }}
								strokeWidth={1.75}
							/>
							<div className="mt-3 text-sm font-semibold text-white">
								{title}
							</div>
							<div
								className="mt-1.5 text-xs leading-relaxed"
								style={{ color: "var(--text-muted)" }}
							>
								{description}
							</div>
						</div>
					))}
				</div>
			</section>
		</div>
	);
}
