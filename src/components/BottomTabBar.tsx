import { Link, useRouterState } from "@tanstack/react-router";
import { AUTH_PATHS } from "#/lib/auth/paths";
import { useNavItems } from "./navItems";

export function BottomTabBar() {
	const { location } = useRouterState();
	const navItems = useNavItems();

	return (
		<nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface sm:hidden">
			<div className="flex items-stretch">
				{navItems.map(({ to, shortLabel, Icon, locked }) => {
					const active = !locked && location.pathname.startsWith(to);
					return (
						<Link
							key={to}
							to={locked ? AUTH_PATHS.signIn : to}
							className={[
								"flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-micro font-medium transition-colors",
								active
									? "text-accent-ink"
									: locked
										? "text-text-faint"
										: "text-text-muted",
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
