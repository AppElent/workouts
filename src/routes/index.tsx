import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Dumbbell, TrendingUp } from "lucide-react";
import { HeaderUser } from "#/lib/auth/HeaderUser";
import { useMessages } from "#/lib/i18n";

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
	const { privacy, support } = useMessages();
	return (
		<div className="relative min-h-screen flex flex-col overflow-hidden bg-bg">
			<div
				aria-hidden
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					width: 400,
					height: 400,
					background:
						"radial-gradient(circle, color-mix(in srgb, var(--accent-fill) 12%, transparent), transparent 65%)",
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
						"radial-gradient(circle, color-mix(in srgb, var(--accent-fill) 6%, transparent), transparent 65%)",
					pointerEvents: "none",
				}}
			/>

			<header className="relative z-10 flex items-center justify-between px-8 py-5">
				<div className="flex items-center gap-2.5">
					<div className="w-[30px] h-[30px] rounded-md flex items-center justify-center font-black bg-accent-fill text-on-accent text-body">
						W
					</div>
					<span className="text-text font-bold text-sm">Foundry</span>
				</div>

				<nav className="hidden sm:flex items-center gap-7">
					<HeaderUser />
				</nav>
			</header>

			<section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-8 py-20">
				<div style={{ maxWidth: 880, width: "100%" }}>
					<p className="mb-6 text-caption font-bold uppercase tracking-[2px] text-accent-ink">
						YOUR GYM. YOUR DATA.
					</p>

					<h1
						className="mb-6"
						style={{ lineHeight: 1.05, letterSpacing: "-1.5px" }}
					>
						<span
							className="block text-text"
							style={{ fontSize: 56, fontWeight: 900 }}
						>
							Track every lift.
						</span>
						<span
							className="block text-text"
							style={{ fontSize: 56, fontWeight: 900 }}
						>
							Own every PR.
						</span>
					</h1>

					<p className="mb-9 mx-auto text-control font-normal leading-[1.6] max-w-[560px] text-text-muted">
						Log sets, track 1RMs, and watch your strength compound — session by
						session.
					</p>

					<div className="flex flex-wrap items-center justify-center gap-3">
						<Link
							to="/log"
							className="inline-flex items-center rounded-full bg-accent-fill px-8 py-3 font-bold text-on-accent text-sm transition-colors hover:bg-accent-pressed"
						>
							Start Logging →
						</Link>
						<Link
							to="/exercises"
							className="inline-flex items-center px-8 py-3 text-text text-sm font-bold border border-border rounded-full transition-colors hover:bg-text/5"
						>
							Browse exercises
						</Link>
					</div>
				</div>
			</section>

			<section className="relative z-10 pb-16 px-8">
				<div
					className="mx-auto grid gap-4 sm:grid-cols-3"
					style={{ maxWidth: 960 }}
				>
					{features.map(({ icon: Icon, title, description }) => (
						<div
							key={title}
							className="rounded-xl p-5 border border-border bg-surface"
						>
							<Icon size={20} className="text-accent-ink" strokeWidth={1.75} />
							<div className="mt-3 text-sm font-semibold text-text">
								{title}
							</div>
							<div className="mt-1.5 text-xs leading-relaxed text-text-muted">
								{description}
							</div>
						</div>
					))}
				</div>
			</section>

			<footer className="relative z-10 pb-8 text-center text-xs">
				<Link to="/privacy" className="text-text-muted hover:text-text">
					{privacy.title}
				</Link>
				<span className="mx-2 text-text-muted">·</span>
				<Link to="/support" className="text-text-muted hover:text-text">
					{support.title}
				</Link>
			</footer>
		</div>
	);
}
