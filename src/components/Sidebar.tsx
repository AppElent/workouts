import { SignedIn, SignedOut, UserButton, useAuth } from "@clerk/clerk-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useState } from "react";
import { isNavItemLocked, NAV_ITEMS } from "./navItems";

export function Sidebar() {
	const [collapsed, setCollapsed] = useState(false);
	const { location } = useRouterState();
	const { isSignedIn } = useAuth();

	return (
		<aside
			className={[
				"hidden sm:flex flex-col h-screen sticky top-0 border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-200",
				collapsed ? "w-16" : "w-56",
			].join(" ")}
		>
			{/* Logo */}
			<div className="flex items-center gap-2 px-4 py-5 border-b border-[var(--border)]">
				<div
					className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center font-black text-black text-sm"
					style={{ background: "var(--accent)" }}
				>
					W
				</div>
				{!collapsed && (
					<span className="font-bold text-sm text-white truncate">
						Workout Tracker
					</span>
				)}
			</div>

			{/* Nav */}
			<nav className="flex-1 py-4 flex flex-col gap-1 px-2">
				{NAV_ITEMS.map(({ to, label, Icon, gated }) => {
					const locked = isNavItemLocked({ gated }, Boolean(isSignedIn));
					const active = !locked && location.pathname.startsWith(to);
					return (
						<Link
							key={to}
							to={locked ? "/login" : to}
							title={collapsed ? label : undefined}
							className={[
								"flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
								active
									? "bg-[var(--accent-dim)] text-[var(--accent)]"
									: locked
										? "text-[var(--text-muted)]/60 hover:text-white hover:bg-white/5"
										: "text-[var(--text-muted)] hover:text-white hover:bg-white/5",
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

			{/* User / Sign in */}
			<div className="flex items-center justify-center p-3 border-t border-[var(--border)]">
				<SignedIn>
					<UserButton />
				</SignedIn>
				<SignedOut>
					<Link
						to="/login"
						className="w-full text-center rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-bold text-black hover:bg-[var(--accent-hover)] transition-colors"
					>
						{collapsed ? "→" : "Sign In"}
					</Link>
				</SignedOut>
			</div>

			{/* Collapse toggle */}
			<button
				type="button"
				onClick={() => setCollapsed((c) => !c)}
				className="flex items-center justify-center p-3 border-t border-[var(--border)] text-[var(--text-muted)] hover:text-white transition-colors"
				aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
			>
				{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
			</button>
		</aside>
	);
}
