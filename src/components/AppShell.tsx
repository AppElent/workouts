import { Outlet } from "@tanstack/react-router";
import { ActiveSessionBar } from "./ActiveSessionBar";
import { BottomTabBar } from "./BottomTabBar";
import { OfflineBanner } from "./OfflineBanner";
import { Sidebar } from "./Sidebar";
import { useActiveSession } from "./useActiveSession";

export function AppShell() {
	const activeSession = useActiveSession();
	const hasSession = !!activeSession;

	return (
		<div className="flex h-screen overflow-hidden bg-bg">
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
