import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { CreateWodForm } from "#/components/wods/CreateWodForm";
import { WodCard } from "#/components/wods/WodCard";

export const Route = createFileRoute("/wods/")({
	component: WodsPageGuarded,
});

function WodsPageGuarded() {
	return (
		<>
			<SignedIn>
				<WodsPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function WodsPage() {
	const wods = useQuery(api.wods.list) ?? [];
	const benchmarks = wods.filter((w) => w.isDefault);
	const mine = wods.filter((w) => !w.isDefault);

	return (
		<div className="p-4 sm:p-6 max-w-4xl mx-auto">
			<h1 className="text-2xl font-bold text-white mb-6">WODs</h1>

			{mine.length > 0 && (
				<section className="mb-8">
					<h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
						My WODs
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{mine.map((wod) => (
							<WodCard key={wod._id} wod={wod} />
						))}
					</div>
				</section>
			)}

			<section className="mb-8">
				<h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
					Benchmarks
				</h2>
				{benchmarks.length > 0 ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{benchmarks.map((wod) => (
							<WodCard key={wod._id} wod={wod} />
						))}
					</div>
				) : (
					<p className="text-[var(--text-muted)] text-sm">
						No benchmark WODs seeded yet.
					</p>
				)}
			</section>

			<CreateWodForm />
		</div>
	);
}
