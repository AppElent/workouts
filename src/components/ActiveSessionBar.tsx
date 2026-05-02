import { api } from "@convex/_generated/api";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Dumbbell } from "lucide-react";
import { useEffect, useState } from "react";

function formatElapsed(startTime: number): string {
	const ms = Date.now() - startTime;
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${hours}h ${String(minutes).padStart(2, "0")}m`;
	}
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ActiveSessionBar() {
	const activeSession = useQuery(api.workoutSessions.getActive);
	const { location } = useRouterState();
	const [elapsed, setElapsed] = useState("");

	useEffect(() => {
		if (!activeSession) return;
		const tick = () => setElapsed(formatElapsed(activeSession.startTime));
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	}, [activeSession]);

	if (!activeSession) return null;
	if (location.pathname.startsWith("/log/")) return null;

	const label = activeSession.name ?? "Active Workout";

	return (
		<div className="fixed bottom-16 sm:bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-4 px-4 py-3 bg-[var(--surface)] border-t border-[var(--accent)]/30">
			<div className="flex items-center gap-3 min-w-0">
				<div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent-dim)] flex items-center justify-center">
					<Dumbbell size={14} className="text-[var(--accent)]" />
				</div>
				<div className="min-w-0">
					<p className="text-sm font-semibold text-white truncate">{label}</p>
					<p className="text-xs text-[var(--text-muted)]">{elapsed}</p>
				</div>
			</div>
			<Link
				to="/log/$sessionId"
				params={{ sessionId: activeSession._id }}
				className="flex-shrink-0 px-4 py-1.5 rounded-lg bg-[var(--accent)] text-black text-sm font-bold hover:bg-[var(--accent-hover)] transition-colors"
			>
				Resume →
			</Link>
		</div>
	);
}
