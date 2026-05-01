import { api } from "@convex/_generated/api";
import { Outlet } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ActiveSessionBar } from "./ActiveSessionBar";
import { BottomTabBar } from "./BottomTabBar";
import { OfflineBanner } from "./OfflineBanner";
import { Sidebar } from "./Sidebar";

export function AppShell() {
	const activeSession = useQuery(api.workoutSessions.getActive);
	const hasSession = !!activeSession;

	return (
		<div className="flex h-screen overflow-hidden bg-[var(--bg)]">
			<OfflineBanner />
			<Sidebar />
			<main
				className={`flex-1 overflow-y-auto ${hasSession ? "pb-32 sm:pb-14" : "pb-16 sm:pb-0"}`}
			>
				<Outlet />
			</main>
			<BottomTabBar />
			<ActiveSessionBar />
		</div>
	);
}
