import {
	BookOpen,
	ClipboardList,
	Dumbbell,
	LayoutDashboard,
	type LucideIcon,
	Radio,
	Timer,
	TrendingUp,
	User,
} from "lucide-react";
import { useMessages } from "#/lib/i18n";

type NavKey =
	| "dashboard"
	| "log"
	| "exercises"
	| "routines"
	| "wods"
	| "hostedWorkouts"
	| "progress"
	| "profile";

export type NavItem = {
	to: string;
	key: NavKey;
	Icon: LucideIcon;
	gated: boolean;
};

export type LocalizedNavItem = NavItem & { label: string; shortLabel: string };

export const NAV_ITEMS = [
	{ to: "/dashboard", key: "dashboard", Icon: LayoutDashboard, gated: true },
	{ to: "/log", key: "log", Icon: Dumbbell, gated: true },
	{ to: "/exercises", key: "exercises", Icon: BookOpen, gated: false },
	{ to: "/routines", key: "routines", Icon: ClipboardList, gated: true },
	{ to: "/wods", key: "wods", Icon: Timer, gated: true },
	{
		to: "/hosted-workouts",
		key: "hostedWorkouts",
		Icon: Radio,
		gated: true,
	},
	{ to: "/progress", key: "progress", Icon: TrendingUp, gated: true },
	{ to: "/account", key: "profile", Icon: User, gated: true },
] as const satisfies readonly NavItem[];

export function isNavItemLocked(
	item: { gated: boolean },
	isSignedIn: boolean,
): boolean {
	return item.gated && !isSignedIn;
}

/** Attaches localized label/shortLabel to each nav item from the active locale's messages. */
export function useNavItems(): readonly LocalizedNavItem[] {
	const { nav } = useMessages();
	return NAV_ITEMS.map((item) => ({
		...item,
		label: nav[item.key].label,
		shortLabel: nav[item.key].shortLabel,
	}));
}
