import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/demo/convex")({
	ssr: false,
	component: ConvexDemo,
});

function ConvexDemo() {
	const exercises = useQuery(api.exercises.list);

	return (
		<div
			className="min-h-screen flex items-center justify-center p-4"
			style={{
				background:
					"linear-gradient(135deg, #667a56 0%, #8fbc8f 25%, #90ee90 50%, #98fb98 75%, #f0fff0 100%)",
			}}
		>
			<div className="w-full max-w-2xl">
				<div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-green-200/50 p-8 mb-6">
					<div className="text-center">
						<h1 className="text-4xl font-bold text-green-800 mb-2">
							Convex Demo
						</h1>
						<p className="text-green-600 text-lg">Powered by real-time sync</p>
						{exercises && (
							<p className="mt-2 text-sm text-green-700">
								{exercises.length} exercises loaded
							</p>
						)}
					</div>
				</div>

				<div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-green-200/50 overflow-hidden">
					{!exercises ? (
						<div className="p-8 text-center">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4" />
							<p className="text-green-600">Loading…</p>
						</div>
					) : exercises.length === 0 ? (
						<div className="p-12 text-center">
							<p className="text-green-600">No exercises found.</p>
						</div>
					) : (
						<div className="divide-y divide-green-100">
							{exercises.map((ex) => (
								<div
									key={ex._id}
									className="p-4 flex items-center justify-between hover:bg-green-50/50 transition-colors"
								>
									<span className="text-gray-800 font-medium">{ex.name}</span>
									<div className="flex items-center gap-2 text-xs text-gray-500">
										<span className="capitalize">{ex.category}</span>
										<span>·</span>
										<span className="capitalize">{ex.equipment}</span>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="text-center mt-6">
					<p className="text-green-700/80 text-sm">
						Built with Convex · Real-time updates · Always in sync
					</p>
				</div>
			</div>
		</div>
	);
}
