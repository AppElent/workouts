import { Link, useRouterState } from '@tanstack/react-router';
import { LayoutDashboard, Dumbbell, ClipboardList, TrendingUp, BookOpen } from 'lucide-react';

const tabs = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/log', label: 'Log', Icon: Dumbbell },
  { to: '/exercises', label: 'Exercises', Icon: BookOpen },
  { to: '/routines', label: 'Routines', Icon: ClipboardList },
  { to: '/progress', label: 'Progress', Icon: TrendingUp },
] as const;

export function BottomTabBar() {
  const { location } = useRouterState();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] sm:hidden">
      <div className="flex items-stretch">
        {tabs.map(({ to, label, Icon }) => {
          const active = location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={[
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
