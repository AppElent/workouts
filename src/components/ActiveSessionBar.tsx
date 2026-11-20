import { formatClock } from "@foundry/core";
import { Link, useRouterState } from "@tanstack/react-router";
import { Dumbbell } from "lucide-react";
import { useEffect, useState } from "react";
import { useMessages } from "#/lib/i18n";
import { useActiveSession } from "./useActiveSession";

export function ActiveSessionBar() {
	const activeSession = useActiveSession();
	const { location } = useRouterState();
	const [elapsed, setElapsed] = useState("");
	const { shell } = useMessages();

	useEffect(() => {
		if (!activeSession) return;
		const tick = () =>
			setElapsed(formatClock((Date.now() - activeSession.startTime) / 1000));
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	}, [activeSession]);

	if (!activeSession) return null;
	if (location.pathname === `/log/${activeSession._id}`) return null;

	const label = activeSession.name ?? shell.activeSession.fallbackName;

	return (
		<div className="fixed bottom-16 sm:bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-4 px-4 py-3 bg-surface border-t border-accent-ink/30">
			<div className="flex items-center gap-3 min-w-0">
				<div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-dim flex items-center justify-center">
					<Dumbbell size={14} className="text-accent-ink" />
				</div>
				<div className="min-w-0">
					<p className="text-sm font-semibold text-text truncate">{label}</p>
					<p className="text-xs text-text-muted">{elapsed}</p>
				</div>
			</div>
			<Link
				to="/log/$sessionId"
				params={{ sessionId: activeSession._id }}
				className="flex-shrink-0 px-4 py-1.5 rounded-lg bg-accent-fill text-on-accent text-sm font-bold hover:bg-accent-pressed transition-colors"
			>
				{shell.activeSession.resume} →
			</Link>
		</div>
	);
}
