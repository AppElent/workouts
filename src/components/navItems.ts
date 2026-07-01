import {
	BookOpen,
	ClipboardList,
	Dumbbell,
	LayoutDashboard,
	Radio,
	type LucideIcon,
	Timer,
	TrendingUp,
	User,
} from "lucide-react";

export type NavItem = {
	to: string;
	label: string;
	shortLabel: string;
	Icon: LucideIcon;
	gated: boolean;
};

export const NAV_ITEMS = [
	{
		to: "/dashboard",
		label: "Dashboard",
		shortLabel: "Dashboard",
		Icon: LayoutDashboard,
		gated: true,
	},
	{
		to: "/log",
		label: "Log Workout",
		shortLabel: "Log",
		Icon: Dumbbell,
		gated: true,
	},
	{
		to: "/exercises",
		label: "Exercises",
		shortLabel: "Exercises",
		Icon: BookOpen,
		gated: false,
	},
	{
		to: "/routines",
		label: "Routines",
		shortLabel: "Routines",
		Icon: ClipboardList,
		gated: true,
	},
	{
		to: "/wods",
		label: "WODs",
		shortLabel: "WODs",
		Icon: Timer,
		gated: true,
	},
	{
		to: "/hosted-workouts",
		label: "Host Workout",
		shortLabel: "Host",
		Icon: Radio,
		gated: true,
	},
	{
		to: "/progress",
		label: "Progress",
		shortLabel: "Progress",
		Icon: TrendingUp,
		gated: true,
	},
	{
		to: "/account",
		label: "Profile",
		shortLabel: "Profile",
		Icon: User,
		gated: true,
	},
] as const satisfies readonly NavItem[];

export function isNavItemLocked(
	item: { gated: boolean },
	isSignedIn: boolean,
): boolean {
	return item.gated && !isSignedIn;
}
