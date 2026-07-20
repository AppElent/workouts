import type { nav as enNav } from "../en/nav";

export const nav = {
	appName: "Workout Tracker",
	dashboard: { label: "Dashboard", shortLabel: "Dashboard" },
	log: { label: "Training loggen", shortLabel: "Log" },
	exercises: { label: "Oefeningen", shortLabel: "Oefeningen" },
	routines: { label: "Routines", shortLabel: "Routines" },
	wods: { label: "WODs", shortLabel: "WODs" },
	hostedWorkouts: { label: "Training hosten", shortLabel: "Hosten" },
	progress: { label: "Voortgang", shortLabel: "Voortgang" },
	profile: { label: "Profiel", shortLabel: "Profiel" },
	expandSidebar: "Zijbalk uitklappen",
	collapseSidebar: "Zijbalk inklappen",
} satisfies typeof enNav;
