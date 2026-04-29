import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { OfflineBanner } from './OfflineBanner';

export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <OfflineBanner />
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-16 sm:pb-0">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}
