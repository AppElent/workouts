import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useState } from "react";
import { LanguageToggle } from "#/components/LanguageToggle";
import { HeaderUser } from "#/lib/auth/HeaderUser";
import { AUTH_PATHS } from "#/lib/auth/paths";
import { useMessages } from "#/lib/i18n";
import { useNavItems } from "./navItems";

export function Sidebar() {
	const [collapsed, setCollapsed] = useState(false);
	const { location } = useRouterState();
	const { nav } = useMessages();
	const navItems = useNavItems();

	return (
		<aside
			className={[
				"hidden sm:flex flex-col h-screen sticky top-0 border-r border-border bg-surface transition-all duration-200",
				collapsed ? "w-16" : "w-56",
			].join(" ")}
		>
			<div className="flex items-center gap-2 px-4 py-5 border-b border-border">
				<div className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center font-black bg-accent-fill text-on-accent text-sm">
					W
				</div>
				{!collapsed && (
					<span className="font-bold text-sm text-text truncate">
						{nav.appName}
					</span>
				)}
			</div>

			<nav className="flex-1 py-4 flex flex-col gap-1 px-2">
				{navItems.map(({ to, label, Icon, locked }) => {
					const active = !locked && location.pathname.startsWith(to);
					return (
						<Link
							key={to}
							to={locked ? AUTH_PATHS.signIn : to}
							title={collapsed ? label : undefined}
							className={[
								"flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
								active
									? "bg-accent-dim text-accent-ink"
									: locked
										? "text-text-faint hover:text-text hover:bg-text/5"
										: "text-text-muted hover:text-text hover:bg-text/5",
							].join(" ")}
							aria-current={active ? "page" : undefined}
						>
							<Icon
								size={18}
								strokeWidth={active ? 2.5 : 1.75}
								className="shrink-0"
							/>
							{!collapsed && <span className="flex-1">{label}</span>}
							{!collapsed && locked && (
								<Lock size={13} className="shrink-0 opacity-70" />
							)}
						</Link>
					);
				})}
			</nav>

			<div className="flex items-center justify-center p-3 border-t border-border">
				<HeaderUser />
			</div>

			{!collapsed && (
				<div className="flex items-center justify-center border-t border-border">
					<LanguageToggle />
				</div>
			)}

			<button
				type="button"
				onClick={() => setCollapsed((c) => !c)}
				className="flex items-center justify-center p-3 border-t border-border text-text-muted hover:text-text transition-colors"
				aria-label={collapsed ? nav.expandSidebar : nav.collapseSidebar}
			>
				{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
			</button>
		</aside>
	);
}
