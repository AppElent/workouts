import { useAuth } from "@clerk/react";
import { HOSTED_WORKOUTS_ENABLED } from "@foundry/core/features";
import { useRouter } from "@tanstack/react-router";
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
import type { FileRouteTypes } from "#/routeTree.gen";

const NAV_ITEMS = [
	{ to: "/dashboard", key: "dashboard", Icon: LayoutDashboard },
	{ to: "/log", key: "log", Icon: Dumbbell },
	{ to: "/exercises", key: "exercises", Icon: BookOpen },
	{ to: "/routines", key: "routines", Icon: ClipboardList },
	{ to: "/wods", key: "wods", Icon: Timer },
	{ to: "/hosted-workouts", key: "hostedWorkouts", Icon: Radio },
	{ to: "/progress", key: "progress", Icon: TrendingUp },
	{ to: "/account", key: "profile", Icon: User },
] as const satisfies readonly {
	to: FileRouteTypes["to"];
	key: string;
	Icon: LucideIcon;
}[];

/** Parked Hosted Workouts (APP-437) drop out of the nav. */
const VISIBLE_NAV_ITEMS = NAV_ITEMS.filter(
	(item) => HOSTED_WORKOUTS_ENABLED || item.key !== "hostedWorkouts",
);

const AUTHED_LAYOUT_ID = "/_app/_authed" satisfies FileRouteTypes["id"];

/**
 * Nav items with localized labels. An item is `locked` while signed out when
 * its route sits under the `_authed` layout.
 */
export function useNavItems() {
	const { nav } = useMessages();
	const { isSignedIn } = useAuth();
	const router = useRouter();
	return VISIBLE_NAV_ITEMS.map((item) => ({
		...item,
		label: nav[item.key].label,
		shortLabel: nav[item.key].shortLabel,
		locked:
			!isSignedIn &&
			router
				.getMatchedRoutes(item.to)[0]
				.some((route) => route.id === AUTHED_LAYOUT_ID),
	}));
}
