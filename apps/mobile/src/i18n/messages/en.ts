/**
 * The phone's words, in the source language.
 *
 * English is written here and Dutch follows in `nl.ts`, which is typed
 * `satisfies typeof en` — so a key added here without a Dutch counterpart is a
 * `pnpm --filter @workouts/mobile typecheck` failure rather than a blank label
 * discovered on a device.
 *
 * Deliberately not shared with the web app's `src/lib/i18n/messages/`. There is
 * no web Nutrition UI (it is out of scope in the spec), so sharing would buy
 * nothing and would couple the two clients' release cadence.
 *
 * No `as const`. The literal types it would produce are exactly what stops
 * `nl.ts` from satisfying this shape.
 */
export const en = {
	tabs: {
		home: "Home",
		train: "Train",
		nutrition: "Nutrition",
		progress: "Progress",
		profile: "Profile",
	},

	common: {
		back: "Go back",
		retry: "Try again",
	},

	preferences: {
		heading: "Preferences",
		units: "Units",
		notifications: "Notifications",
		connectedApps: "Connected apps",
		language: "Language",
	},

	language: {
		title: "Language",
		description:
			"Workouts starts in your phone's language and stays in the one you choose here.",
		names: {
			en: "English",
			nl: "Nederlands",
		},
	},

	nutrition: {
		title: "Nutrition",

		day: {
			today: "Today",
			yesterday: "Yesterday",
			tomorrow: "Tomorrow",
			previousDay: "Previous day",
			nextDay: "Next day",
			goToToday: "Go to today",
			loading: "Loading the day",
		},

		goals: {
			heading: "Goals",
			empty: {
				title: "No goals yet",
				body: "Set a daily amount for the nutrients you care about, and the day fills in against them.",
				action: "Set up goals",
			},
			unavailable: "Goal setup arrives in the next update.",
			/** "1,426 of 2,100 kcal" */
			progress: "{total} of {target} {unit}",
			state: {
				neutral: "Nothing logged",
				under: "Under",
				met: "Met",
				within: "Within",
				exceeded: "Over",
			},
		},

		meals: {
			breakfast: "Breakfast",
			lunch: "Lunch",
			dinner: "Dinner",
			snacks: "Snacks",
		},

		/** The accessible name of a meal slot's icon-only plus control. */
		addTo: "Add food to {meal}",
		mealEmpty: "Nothing logged yet. Use + to add a food.",
		foodBrowser: {
			title: "Find food for {meal}",
			searchPlaceholder: "Search foods",
			searchAll: "Search all 2,328 foods",
			showMore: "Show more foods",
			promotedResults: "Everyday foods",
			allResults: "All NEVO foods",
			empty: "No foods match this search.",
			per100: "Nutrition per 100",
			serving: "Serving",
			quantity: "Quantity",
			trace: "Trace",
			absent: "Not available",
		},

		otherNutrients: {
			heading: "Other nutrients",
			show: "Show other nutrients",
			hide: "Hide other nutrients",
		},

		nutrients: {
			energy: "Energy",
			protein: "Protein",
			carbs: "Carbohydrates",
			fat: "Fat",
			saturatedFat: "Saturated fat",
			fibre: "Fibre",
			sugars: "Sugars",
			salt: "Salt",
		},

		units: {
			kcal: "kcal",
			g: "g",
		},

		attribution: {
			nevo: "Nutrition figures include NEVO 2025/9.0 data.",
			salt: "Salt is derived by Appelent from the source's sodium.",
			incomplete: "Totals are marked where source values are absent.",
		},

		error: {
			title: "This day could not be opened",
			body: "Something went wrong while building the view.",
		},
	},
};

/** The shape every locale has to provide. */
export type Messages = typeof en;
