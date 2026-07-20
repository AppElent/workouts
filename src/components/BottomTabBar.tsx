import { useAuth } from "@clerk/clerk-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { isNavItemLocked, useNavItems } from "./navItems";

export function BottomTabBar() {
	const { location } = useRouterState();
	const { isSignedIn } = useAuth();
	const navItems = useNavItems();

	return (
		<nav className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] sm:hidden">
			<div className="flex items-stretch">
				{navItems.map(({ to, shortLabel, Icon, gated }) => {
					const locked = isNavItemLocked({ gated }, Boolean(isSignedIn));
					const active = !locked && location.pathname.startsWith(to);
					return (
						<Link
							key={to}
							to={locked ? "/sign-in" : to}
							className={[
								"flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
								active
									? "text-[var(--accent)]"
									: locked
										? "text-[var(--text-muted)]/60"
										: "text-[var(--text-muted)]",
							].join(" ")}
							aria-current={active ? "page" : undefined}
						>
							<Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
							{shortLabel}
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
